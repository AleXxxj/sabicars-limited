import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { dealers, locations, vehicleMedia, vehicles, type Vehicle, type VehicleMedia } from "@/db/schema";
import type { InventoryFilters } from "@/lib/inventory-filters";

/**
 * Statuses that appear in listings. A reserved car stays listed (marked
 * Reserved) so interest is not lost if the reservation lapses; drafts and
 * unlisted cars never leave the admin.
 */
const LISTED = ["available", "reserved"] as const;

/**
 * A sold car keeps its own page — a link someone shared still works, and a
 * record of what Sabicars has sold is proof in itself — but it leaves the
 * listings and is not offered to search engines.
 */
const HAS_PAGE = ["available", "reserved", "sold"] as const;

export const PAGE_SIZE = 24;

export type VehicleWithCover = Vehicle & { cover: Pick<VehicleMedia, "url" | "alt" | "width" | "height"> | null };

/** The dealer every public page belongs to until the dealer network opens (architecture §2.3). */
const sabicarsId = cache(async (): Promise<string> => {
  const [row] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, "sabicars")).limit(1);
  if (!row) throw new Error("The Sabicars dealer row is missing — run the legacy import or seed.");
  return row.id;
});

async function withCovers(rows: Vehicle[]): Promise<VehicleWithCover[]> {
  if (!rows.length) return [];
  const covers = await db
    .select({ vehicleId: vehicleMedia.vehicleId, url: vehicleMedia.url, alt: vehicleMedia.alt, width: vehicleMedia.width, height: vehicleMedia.height })
    .from(vehicleMedia)
    .where(and(inArray(vehicleMedia.vehicleId, rows.map((r) => r.id)), eq(vehicleMedia.position, 0), eq(vehicleMedia.kind, "photo")));
  const byVehicle = new Map(covers.map(({ vehicleId, ...c }) => [vehicleId, c]));
  return rows.map((r) => ({ ...r, cover: byVehicle.get(r.id) ?? null }));
}

/** Featured first, then newest — what the homepage and showcases lead with. */
export async function featuredVehicles(limit = 6): Promise<VehicleWithCover[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])))
    .orderBy(desc(vehicles.isFeatured), desc(vehicles.createdAt))
    .limit(limit);
  return withCovers(rows);
}

/** Vehicles staff have chosen for the homepage hero. */
export async function heroVehicles(limit = 8): Promise<VehicleWithCover[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), eq(vehicles.inHero, true), inArray(vehicles.status, [...LISTED])))
    .orderBy(desc(vehicles.createdAt))
    .limit(limit);
  return withCovers(rows);
}

/* ── Inventory search ──────────────────────────────────────────────────── */

type Facet = "make" | "body" | "segment";

function filterConditions(dealerId: string, f: InventoryFilters, omit: Facet[] = []): SQL[] {
  const where: SQL[] = [eq(vehicles.dealerId, dealerId), inArray(vehicles.status, [...LISTED])];
  if (f.body && !omit.includes("body")) where.push(eq(vehicles.body, f.body));
  if (f.segment && !omit.includes("segment")) where.push(eq(vehicles.segment, f.segment));
  if (f.make && !omit.includes("make")) where.push(eq(vehicles.make, f.make));
  if (f.condition) where.push(eq(vehicles.condition, f.condition));
  if (f.minPrice) where.push(gte(vehicles.priceMinor, f.minPrice * 100));
  if (f.maxPrice) where.push(lte(vehicles.priceMinor, f.maxPrice * 100));
  return where;
}

const ORDER: Record<InventoryFilters["sort"], SQL[]> = {
  // Price on request sorts last whichever way prices run — it is not "cheapest".
  newest: [desc(vehicles.createdAt)],
  price_asc: [sql`${vehicles.priceMinor} ASC NULLS LAST`, desc(vehicles.createdAt)],
  price_desc: [sql`${vehicles.priceMinor} DESC NULLS LAST`, desc(vehicles.createdAt)],
  year_desc: [desc(vehicles.year), desc(vehicles.createdAt)],
};

export interface InventoryResult {
  vehicles: VehicleWithCover[];
  total: number;
  page: number;
  pages: number;
  /** Counts that ignore their own filter, so choosing "Lexus" still shows how many Toyotas there are. */
  makes: { make: string; count: number }[];
  bodies: { body: NonNullable<Vehicle["body"]>; count: number }[];
  /** What "All" would show: every type, including vehicles whose body type is not yet recorded. */
  allTypesCount: number;
}

export async function searchInventory(f: InventoryFilters): Promise<InventoryResult> {
  const dealerId = await sabicarsId();
  const where = and(...filterConditions(dealerId, f));

  const [[{ total }], [{ allTypesCount }], rows, makes, bodies] = await Promise.all([
    db.select({ total: count() }).from(vehicles).where(where),
    db
      .select({ allTypesCount: count() })
      .from(vehicles)
      .where(and(...filterConditions(dealerId, f, ["body", "segment"]))),
    db
      .select()
      .from(vehicles)
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db
      .select({ make: vehicles.make, count: count() })
      .from(vehicles)
      .where(and(...filterConditions(dealerId, f, ["make"])))
      .groupBy(vehicles.make)
      .orderBy(desc(count()), asc(vehicles.make)),
    db
      .select({ body: vehicles.body, count: count() })
      .from(vehicles)
      .where(and(...filterConditions(dealerId, f, ["body"]), sql`${vehicles.body} IS NOT NULL`))
      .groupBy(vehicles.body)
      .orderBy(desc(count())),
  ]);

  return {
    vehicles: await withCovers(rows),
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    makes,
    bodies: bodies.filter((b): b is { body: NonNullable<Vehicle["body"]>; count: number } => b.body !== null),
    allTypesCount,
  };
}

/* ── A single vehicle ──────────────────────────────────────────────────── */

export interface VehicleDetail {
  vehicle: Vehicle;
  media: VehicleMedia[];
  location: { name: string; addressLine1: string; addressLine2: string | null; city: string } | null;
}

/**
 * Wrapped in React's cache so generateMetadata and the page share one query
 * per request rather than hitting the database twice.
 */
export const vehicleBySlug = cache(async (slug: string): Promise<VehicleDetail | null> => {
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), eq(vehicles.slug, slug), inArray(vehicles.status, [...HAS_PAGE])))
    .limit(1);
  if (!vehicle) return null;

  const [media, [location]] = await Promise.all([
    db.select().from(vehicleMedia).where(eq(vehicleMedia.vehicleId, vehicle.id)).orderBy(asc(vehicleMedia.position)),
    vehicle.locationId
      ? db
          .select({ name: locations.name, addressLine1: locations.addressLine1, addressLine2: locations.addressLine2, city: locations.city })
          .from(locations)
          .where(eq(locations.id, vehicle.locationId))
          .limit(1)
      : Promise.resolve([undefined]),
  ]);
  return { vehicle, media, location: location ?? null };
});

/** Same shape of vehicle first, then the same segment — what a buyer of this car would also consider. */
export async function similarVehicles(v: Vehicle, limit = 3): Promise<VehicleWithCover[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, v.dealerId), inArray(vehicles.status, [...LISTED]), ne(vehicles.id, v.id)))
    .orderBy(
      sql`CASE WHEN ${vehicles.body} = ${v.body} THEN 0 WHEN ${vehicles.segment} = ${v.segment} THEN 1 ELSE 2 END`,
      sql`abs(coalesce(${vehicles.priceMinor}, 0) - ${v.priceMinor ?? 0})`,
    )
    .limit(limit);
  return withCovers(rows);
}

/** Every vehicle address to offer search engines and to pre-render at build. */
export async function listedVehicleSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: vehicles.slug, updatedAt: vehicles.updatedAt })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])));
}
