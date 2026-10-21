"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { audit } from "@/lib/audit";
import { can, requireStaff, type StaffMember } from "@/lib/auth";
import { isGenuineUpload, uploadTicket, type UploadedAsset, type UploadTicket } from "@/lib/cloudinary";
import { CODE_ALPHABET, checkFor, publishProblems, type Items, type Result } from "@/lib/inspection/checklist";
import { refreshPublicPages } from "@/lib/public-pages";

export interface InspectionResult {
  ok: boolean;
  error?: string;
  /** For publishing: everything still missing, so the inspector can fix it in one pass. */
  problems?: string[];
  fieldErrors?: Record<string, string>;
  savedAt?: number;
}

/**
 * A report this staff member's dealer owns, with its car's slug for refreshing
 * pages and whether the car is held away from the showroom. Read fresh on every
 * call, so a car moved offsite after its draft was started is still caught.
 */
async function ownReport(me: StaffMember, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ report: inspections, slug: vehicles.slug, heldOffsite: vehicles.heldOffsite })
    .from(inspections)
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(and(eq(inspections.id, id), eq(inspections.dealerId, me.dealerId)))
    .limit(1);
  return row ?? null;
}

function newCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function refresh(vehicleId: string, slug: string, code: string) {
  refreshPublicPages(slug);
  revalidatePath(`/v/${code}`);
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  revalidatePath(`/admin/vehicles/${vehicleId}/inspection`);
}

/**
 * Opens the car's draft report, starting one if there is none. A car held away
 * from the showroom gets no draft: the Sabicars Verified seal is only for cars
 * inspected at the showroom, so the page just explains why.
 */
export async function startInspection(vehicleId: string): Promise<void> {
  const me = await requireStaff();
  const [v] = await db
    .select({ id: vehicles.id, chassisNo: vehicles.chassisNo, heldOffsite: vehicles.heldOffsite })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerId, me.dealerId)))
    .limit(1);
  if (!v) redirect("/admin/vehicles");
  if (v.heldOffsite) redirect(`/admin/vehicles/${v.id}/inspection`);
  const [draft] = await db
    .select({ id: inspections.id })
    .from(inspections)
    .where(and(eq(inspections.vehicleId, v.id), eq(inspections.status, "draft")))
    .limit(1);
  if (!draft) {
    // Six characters from 31 gives 887 million codes; a clash is rare, and retried.
    for (let attempt = 0; ; attempt++) {
      try {
        const [row] = await db
          .insert(inspections)
          .values({ dealerId: me.dealerId, vehicleId: v.id, code: newCode(), vin: v.chassisNo, createdBy: me.id })
          .returning({ id: inspections.id, code: inspections.code });
        await audit(me, "vehicle", v.id, "inspection_started", { code: row.code });
        break;
      } catch (e) {
        if (attempt < 4 && e instanceof Error && /inspections_code_idx/.test(e.message)) continue;
        throw e;
      }
    }
  }
  redirect(`/admin/vehicles/${v.id}/inspection`);
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (maxLen: number) => z.preprocess(blank, z.string().trim().max(maxLen).optional());
const optInt = (min: number, maxVal: number, message: string) =>
  z.preprocess((v) => blank(typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.coerce.number().int(message).min(min, message).max(maxVal, message).optional());
const optDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").optional());

const header = z.object({
  inspectedOn: optDate,
  inspectorName: optText(80),
  odometerKm: optInt(0, 2_000_000, "Kilometres as a whole number"),
  vin: z.preprocess(blank, z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,20}$/, "Letters, numbers and dashes, as on the frame").optional()),
  summary: optText(1200),
  historySource: optText(80),
  historyCheckedOn: optDate,
  historyTitle: z.preprocess(blank, z.enum(["clean", "salvage", "rebuilt", "flood", "other", "no_record"]).optional()),
  historyAccidents: optInt(0, 50, "A whole number"),
  historyLastOdometerKm: optInt(0, 2_000_000, "Kilometres as a whole number"),
  historyNotes: optText(600),
});

/** A date chosen in Lagos, stored at Lagos midday so no time zone can move it to another day. */
const lagosDay = (d: string | undefined) => (d ? new Date(`${d}T12:00:00+01:00`) : null);

export async function saveInspectionDetails(_prev: InspectionResult | null, formData: FormData): Promise<InspectionResult> {
  const me = await requireStaff();
  const found = await ownReport(me, String(formData.get("id") ?? ""));
  if (!found) return { ok: false, error: "That report no longer exists." };
  if (found.report.status !== "draft") return { ok: false, error: "A published report cannot be changed. Start a new inspection instead." };
  const parsed = header.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Some details need fixing.", fieldErrors };
  }
  const h = parsed.data;
  await db
    .update(inspections)
    .set({
      inspectedAt: lagosDay(h.inspectedOn),
      inspectorName: h.inspectorName ?? null,
      odometerKm: h.odometerKm ?? null,
      vin: h.vin ?? null,
      summary: h.summary ?? null,
      historySource: h.historySource ?? null,
      historyCheckedAt: lagosDay(h.historyCheckedOn),
      historyTitle: h.historyTitle ?? null,
      historyAccidents: h.historyAccidents ?? null,
      historyLastOdometerKm: h.historyLastOdometerKm ?? null,
      historyNotes: h.historyNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(inspections.id, found.report.id));
  revalidatePath(`/admin/vehicles/${found.report.vehicleId}/inspection`);
  return { ok: true, savedAt: Date.now() };
}

const RESULTS = ["pass", "attention", "fail", "na"] as const;

/**
 * Records one check. The row is locked while it is read and written, so two
 * people ticking checks on the same car never overwrite each other's results.
 */
async function updateItem(reportId: string, key: string, change: (items: Items) => Items): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ items: inspections.items }).from(inspections).where(eq(inspections.id, reportId)).for("update");
    await tx
      .update(inspections)
      .set({ items: change({ ...(row?.items ?? {}) }), updatedAt: new Date() })
      .where(eq(inspections.id, reportId));
  });
}

/** Records a check's result and note; a photo already attached to it is kept. */
export async function saveCheck(reportId: string, key: string, result: Result, note: string): Promise<InspectionResult> {
  const me = await requireStaff();
  const found = await ownReport(me, reportId);
  if (!found) return { ok: false, error: "That report no longer exists." };
  if (found.report.status !== "draft") return { ok: false, error: "A published report cannot be changed." };
  if (!checkFor(key)) return { ok: false, error: "Unknown check." };
  if (!RESULTS.includes(result)) return { ok: false, error: "Unknown result." };
  const trimmed = note.trim().slice(0, 400);
  await updateItem(reportId, key, (items) => {
    const photo = items[key]?.photo;
    items[key] = { result, ...(trimmed ? { note: trimmed } : {}), ...(photo ? { photo } : {}) };
    return items;
  });
  return { ok: true, savedAt: Date.now() };
}

export async function inspectionPhotoTicket(reportId: string): Promise<UploadTicket | { error: string }> {
  const me = await requireStaff();
  const found = await ownReport(me, reportId);
  if (!found) return { error: "That report no longer exists." };
  if (found.report.status !== "draft") return { error: "A published report cannot be changed." };
  return uploadTicket(found.report.vehicleId, "inspection");
}

export async function recordCheckPhoto(reportId: string, key: string, asset: UploadedAsset): Promise<InspectionResult> {
  const me = await requireStaff();
  const found = await ownReport(me, reportId);
  if (!found) return { ok: false, error: "That report no longer exists." };
  if (found.report.status !== "draft") return { ok: false, error: "A published report cannot be changed." };
  if (!checkFor(key)) return { ok: false, error: "Unknown check." };
  if (!isGenuineUpload(asset, found.report.vehicleId, "inspection")) return { ok: false, error: "That upload could not be verified. Please try again." };
  let refused = false;
  await updateItem(reportId, key, (items) => {
    const prev = items[key];
    // A photo is evidence for a result, so the check needs one first.
    if (!prev?.result) {
      refused = true;
      return items;
    }
    items[key] = { ...prev, photo: { url: asset.secure_url, publicId: asset.public_id } };
    return items;
  });
  if (refused) return { ok: false, error: "Choose a result for this check before adding its photo." };
  return { ok: true, savedAt: Date.now() };
}

export async function removeCheckPhoto(reportId: string, key: string): Promise<InspectionResult> {
  const me = await requireStaff();
  const found = await ownReport(me, reportId);
  if (!found) return { ok: false, error: "That report no longer exists." };
  if (found.report.status !== "draft") return { ok: false, error: "A published report cannot be changed." };
  await updateItem(reportId, key, (items) => {
    if (items[key]) {
      const next = { ...items[key] };
      delete next.photo;
      items[key] = next;
    }
    return items;
  });
  return { ok: true, savedAt: Date.now() };
}

/**
 * Puts the seal on a report: checks it is complete, then makes it the car's
 * live report, superseding the previous one in the same transaction.
 */
export async function publishInspection(reportId: string): Promise<InspectionResult> {
  const me = await requireStaff();
  if (!can.publishInspection(me)) return { ok: false, error: "Only a manager or the owner can publish a report." };
  const found = await ownReport(me, reportId);
  if (!found) return { ok: false, error: "That report no longer exists." };
  const r = found.report;
  if (r.status !== "draft") return { ok: false, error: "This report is already published." };
  // Checked at publish time, not when the draft was started: the car may have been moved since.
  if (found.heldOffsite) return { ok: false, error: "This car is not at the Sabicars showroom, so it cannot carry the Sabicars Verified seal." };
  const problems = publishProblems(r.items, r);
  if (problems.length) return { ok: false, error: "The report is not complete yet.", problems };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(inspections)
      .set({ status: "superseded", updatedAt: now })
      .where(and(eq(inspections.vehicleId, r.vehicleId), eq(inspections.status, "published")));
    await tx.update(inspections).set({ status: "published", publishedAt: now, publishedBy: me.id, updatedAt: now }).where(eq(inspections.id, r.id));
  });
  await audit(me, "vehicle", r.vehicleId, "inspection_published", { code: r.code });
  refresh(r.vehicleId, found.slug, r.code);
  return { ok: true, savedAt: Date.now() };
}

/** Takes a live report down, for a report published in error. The car loses its Verified badge until a new one is published. */
export async function withdrawInspection(reportId: string): Promise<InspectionResult> {
  const me = await requireStaff();
  if (!can.publishInspection(me)) return { ok: false, error: "Only a manager or the owner can withdraw a report." };
  const found = await ownReport(me, reportId);
  if (!found) return { ok: false, error: "That report no longer exists." };
  if (found.report.status !== "published") return { ok: false, error: "Only a live report can be withdrawn." };
  await db.update(inspections).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(inspections.id, found.report.id));
  await audit(me, "vehicle", found.report.vehicleId, "inspection_withdrawn", { code: found.report.code });
  refresh(found.report.vehicleId, found.slug, found.report.code);
  return { ok: true, savedAt: Date.now() };
}

/** Throws away an unpublished draft. */
export async function discardInspection(reportId: string): Promise<void> {
  const me = await requireStaff();
  const found = await ownReport(me, reportId);
  if (found && found.report.status === "draft") {
    await db.delete(inspections).where(and(eq(inspections.id, found.report.id), eq(inspections.status, "draft")));
    await audit(me, "vehicle", found.report.vehicleId, "inspection_discarded", { code: found.report.code });
    revalidatePath(`/admin/vehicles/${found.report.vehicleId}`);
    redirect(`/admin/vehicles/${found.report.vehicleId}`);
  }
  redirect("/admin/vehicles");
}
