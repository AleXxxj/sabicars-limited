import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { inspections, staff, vehicleMedia, vehicles, type Inspection, type Vehicle } from "@/db/schema";
import { CHECKS, CODE_PATTERN, checkFor, isFresh, tally, type Tally } from "@/lib/inspection/checklist";

/** What a listing needs to know about its car's live report: enough for the badge and the link. */
export interface Verification {
  code: string;
  inspectedAt: Date;
  fresh: boolean;
}

/** The live (published) report of each car, by vehicle id. One query for a whole grid. */
export async function verificationMap(vehicleIds: string[], now = new Date()): Promise<Map<string, Verification>> {
  if (!vehicleIds.length) return new Map();
  const rows = await db
    .select({ vehicleId: inspections.vehicleId, code: inspections.code, inspectedAt: inspections.inspectedAt })
    .from(inspections)
    .where(and(inArray(inspections.vehicleId, vehicleIds), eq(inspections.status, "published")));
  return new Map(
    rows
      .filter((r): r is typeof r & { inspectedAt: Date } => r.inspectedAt !== null)
      .map((r) => [r.vehicleId, { code: r.code, inspectedAt: r.inspectedAt, fresh: isFresh(r.inspectedAt, now) }]),
  );
}

export interface PublicReport {
  report: Inspection;
  tally: Tally;
  vehicle: Pick<Vehicle, "id" | "slug" | "year" | "make" | "model" | "trim" | "status" | "chassisNo"> & { coverUrl: string | null };
  /** For a superseded report: the code of the report that replaced it. */
  replacedBy: string | null;
}

/**
 * A report as the public sees it, by the code on the windscreen seal.
 * Drafts and withdrawn reports do not exist in public. A superseded report
 * still opens, so an old sticker or link explains itself and points onward.
 */
export async function reportByCode(code: string): Promise<PublicReport | null> {
  const upper = code.toUpperCase();
  if (!CODE_PATTERN.test(upper)) return null;
  const [row] = await db
    .select({ report: inspections, vehicle: vehicles })
    .from(inspections)
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(and(eq(inspections.code, upper), inArray(inspections.status, ["published", "superseded"])))
    .limit(1);
  if (!row) return null;
  const [cover] = await db
    .select({ url: vehicleMedia.url })
    .from(vehicleMedia)
    .where(and(eq(vehicleMedia.vehicleId, row.vehicle.id), eq(vehicleMedia.position, 0), eq(vehicleMedia.kind, "photo")))
    .limit(1);
  let replacedBy: string | null = null;
  if (row.report.status === "superseded") {
    const [live] = await db
      .select({ code: inspections.code })
      .from(inspections)
      .where(and(eq(inspections.vehicleId, row.vehicle.id), eq(inspections.status, "published")))
      .limit(1);
    replacedBy = live?.code ?? null;
  }
  const { id, slug, year, make, model, trim, status, chassisNo } = row.vehicle;
  return {
    report: row.report,
    tally: tally(row.report.items),
    vehicle: { id, slug, year, make, model, trim, status, chassisNo, coverUrl: cover?.url ?? null },
    replacedBy,
  };
}

/** The car's live report, with its counts, for the vehicle page. */
export async function liveReportFor(vehicleId: string): Promise<{ report: Inspection; tally: Tally } | null> {
  const [report] = await db
    .select()
    .from(inspections)
    .where(and(eq(inspections.vehicleId, vehicleId), eq(inspections.status, "published")))
    .limit(1);
  return report ? { report, tally: tally(report.items) } : null;
}

/** Every report on one car, newest first, for the admin. */
export async function reportsForVehicle(dealerId: string, vehicleId: string) {
  return db
    .select({ report: inspections, createdByName: staff.fullName, createdByEmail: staff.email })
    .from(inspections)
    .leftJoin(staff, eq(staff.id, inspections.createdBy))
    .where(and(eq(inspections.dealerId, dealerId), eq(inspections.vehicleId, vehicleId)))
    .orderBy(desc(inspections.createdAt));
}

/**
 * One line per car for Ask Sabicars: what the live report found, in words,
 * so the assistant can answer "has it been inspected?" from the record and
 * nothing else.
 */
export async function reportSummaries(vehicleIds: string[], now = new Date()): Promise<Map<string, string>> {
  if (!vehicleIds.length) return new Map();
  const rows = await db
    .select()
    .from(inspections)
    .where(and(inArray(inspections.vehicleId, vehicleIds), eq(inspections.status, "published")));
  const out = new Map<string, string>();
  for (const r of rows) {
    if (!r.inspectedAt) continue;
    const t = tally(r.items);
    const date = r.inspectedAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
    const findings = CHECKS.filter((c) => r.items[c.key]?.result === "attention" || r.items[c.key]?.result === "fail").map((c) => {
      const it = r.items[c.key];
      return `${it.result === "fail" ? "FAULT" : "needs attention"}: ${checkFor(c.key)?.label}${it.note ? ` (${it.note.replace(/\s+/g, " ").trim()})` : ""}`;
    });
    out.set(
      r.vehicleId,
      [
        `Sabicars Verified report ${r.code} (/v/${r.code}): inspected ${date} by ${r.inspectorName}, odometer ${r.odometerKm?.toLocaleString("en-NG")} km.`,
        `${t.pass} of ${t.total} checks good${t.na ? ` (${t.na} not applicable)` : ""}.`,
        findings.length ? `Findings: ${findings.join("; ")}.` : "No findings.",
        r.historySource ? `History (${r.historySource}): ${r.historyTitle ?? "title not recorded"}${r.historyAccidents !== null ? `, ${r.historyAccidents} accident${r.historyAccidents === 1 ? "" : "s"} recorded` : ""}.` : "No history report yet.",
        isFresh(r.inspectedAt, now) ? null : "This report is more than four months old; offer a fresh inspection.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  return out;
}
