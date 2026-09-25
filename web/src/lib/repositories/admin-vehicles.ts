import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, consignors, locations, vehicleMedia, vehicles, type Vehicle } from "@/db/schema";
import { attentionFor, type Attention } from "@/lib/vehicle-quality";

export const ADMIN_STATUSES = ["available", "reserved", "draft", "sold", "unlisted"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export interface AdminVehicleRow {
  vehicle: Vehicle;
  coverUrl: string | null;
  photoCount: number;
  attention: Attention[];
}

/**
 * The staff inventory list: every status, newest change first, each row with
 * what still needs doing. "Needs attention" is computed, not stored, so it
 * always reflects the listing as it is now.
 */
export async function adminVehicleList(
  dealerId: string,
  opts: { status?: AdminStatus; q?: string; attentionOnly?: boolean },
): Promise<{ rows: AdminVehicleRow[]; counts: Record<AdminStatus | "all", number> }> {
  const where: SQL[] = [eq(vehicles.dealerId, dealerId)];
  if (opts.status) where.push(eq(vehicles.status, opts.status));
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(vehicles.make, like), ilike(vehicles.model, like), sql`${vehicles.year}::text = ${opts.q}`)!);
  }

  const [list0, statusCounts] = await Promise.all([
    db.select().from(vehicles).where(and(...where)).orderBy(desc(vehicles.updatedAt)),
    db.select({ status: vehicles.status, n: count() }).from(vehicles).where(eq(vehicles.dealerId, dealerId)).groupBy(vehicles.status),
  ]);

  // Photo counts and covers in one grouped query. (A correlated subquery here
  // is fragile: Drizzle writes the outer "id" unqualified, and inside a
  // subquery over vehicle_media that silently means the photo's own id.)
  const media = list0.length
    ? await db
        .select({
          vehicleId: vehicleMedia.vehicleId,
          n: count(),
          cover: sql<string | null>`max(${vehicleMedia.url}) FILTER (WHERE ${vehicleMedia.position} = 0)`,
        })
        .from(vehicleMedia)
        .where(inArray(vehicleMedia.vehicleId, list0.map((v) => v.id)))
        .groupBy(vehicleMedia.vehicleId)
    : [];
  const byVehicle = new Map(media.map((m) => [m.vehicleId, m]));
  const rows = list0.map((vehicle) => ({ vehicle, photoCount: byVehicle.get(vehicle.id)?.n ?? 0, coverUrl: byVehicle.get(vehicle.id)?.cover ?? null }));

  const counts = { all: 0, available: 0, reserved: 0, draft: 0, sold: 0, unlisted: 0 } as Record<AdminStatus | "all", number>;
  for (const { status, n } of statusCounts) {
    counts[status] = n;
    counts.all += n;
  }

  let list = rows.map((r) => ({ vehicle: r.vehicle, coverUrl: r.coverUrl, photoCount: r.photoCount, attention: attentionFor(r.vehicle, r.photoCount) }));
  if (opts.attentionOnly) list = list.filter((r) => r.attention.some((a) => a.level === "fix"));
  return { rows: list, counts };
}

/** Everything the edit screen needs, or null if the vehicle is not this dealer's. */
export async function vehicleForEdit(dealerId: string, id: string) {
  const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.dealerId, dealerId))).limit(1);
  if (!vehicle) return null;
  const [media, history] = await Promise.all([
    db.select().from(vehicleMedia).where(eq(vehicleMedia.vehicleId, id)).orderBy(asc(vehicleMedia.position)),
    db
      .select({ action: auditLog.action, actorEmail: auditLog.actorEmail, at: auditLog.at, diff: auditLog.diff })
      .from(auditLog)
      .where(and(eq(auditLog.entity, "vehicle"), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.at))
      .limit(12),
  ]);
  return { vehicle, media, history };
}

/** Choices for the form's select boxes. */
export async function formOptions(dealerId: string) {
  const [consignorList, locationList, makes] = await Promise.all([
    db.select({ id: consignors.id, name: consignors.name }).from(consignors).where(eq(consignors.dealerId, dealerId)).orderBy(asc(consignors.name)),
    db.select({ id: locations.id, name: locations.name }).from(locations).where(eq(locations.dealerId, dealerId)).orderBy(asc(locations.name)),
    db.selectDistinct({ make: vehicles.make }).from(vehicles).where(eq(vehicles.dealerId, dealerId)).orderBy(asc(vehicles.make)),
  ]);
  return { consignors: consignorList, locations: locationList, makes: makes.map((m) => m.make) };
}
