"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { consignors, locations, vehicleMedia, vehicles } from "@/db/schema";
import { audit, changes } from "@/lib/audit";
import { can, requireStaff, type StaffMember } from "@/lib/auth";
import { isGenuineUpload, uploadTicket, type UploadedAsset, type UploadTicket } from "@/lib/cloudinary";
import { slugify } from "@/lib/legacy/normalise";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Set on a successful save, so the form can say so without a reload. */
  savedAt?: number;
}

/* ── Parsing the form ──────────────────────────────────────────────────── */

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (maxLen: number) => z.preprocess(blank, z.string().trim().max(maxLen).optional());
const optInt = (min: number, maxVal: number, message: string) =>
  z.preprocess((v) => blank(typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.coerce.number().int(message).min(min, message).max(maxVal, message).optional());
/** `const` keeps the literal values ("suv" | "bus" …) instead of widening them to string. */
const optEnum = <const T extends readonly [string, ...string[]]>(values: T) => z.preprocess(blank, z.enum(values).optional());

/**
 * Naira as a salesperson types it — "38,000,000", "₦38 000 000" — to kobo.
 * Anything else (a stray letter, a decimal point) is refused rather than
 * guessed at: "31,000,000Z" is how the legacy data got its bad price.
 */
const naira = z.preprocess(
  (v) => blank(typeof v === "string" ? v.replace(/[₦,\s]/g, "") : v),
  z.string().regex(/^\d+$/, "Digits only, e.g. 38,000,000").transform((d) => Number(d) * 100).optional(),
);

const thisYear = new Date().getFullYear();

const schema = z.object({
  id: z.preprocess(blank, z.uuid().optional()),
  make: z.string().trim().min(1, "Enter the make").max(40),
  model: z.string().trim().min(1, "Enter the model").max(80),
  trim: optText(60),
  year: z.coerce.number().int().min(1950, "Enter a real year").max(thisYear + 1, `No later than ${thisYear + 1}`),
  body: optEnum(["sedan", "suv", "bus", "van", "pickup", "truck", "coupe", "hatchback", "wagon", "convertible", "other"]),
  segment: z.enum(["standard", "luxury", "commercial"]),
  condition: z.enum(["foreign_used", "nigerian_used", "brand_new"]),
  chassisNo: optText(40),
  mileageKm: optInt(0, 2_000_000, "Kilometres as a whole number"),
  fuel: optEnum(["petrol", "diesel", "hybrid", "electric", "cng", "other"]),
  transmission: optEnum(["automatic", "manual", "other"]),
  transmissionDetail: optText(60),
  drivetrain: optEnum(["fwd", "rwd", "awd", "4wd"]),
  engine: optText(80),
  horsepower: optInt(20, 2500, "Between 20 and 2,500"),
  exteriorColour: optText(40),
  interiorColour: optText(40),
  seats: optInt(1, 80, "Between 1 and 80"),
  price: naira,
  wasPrice: naira,
  status: z.enum(["draft", "available", "reserved", "sold", "unlisted"]),
  badge: optEnum(["hot", "premium", "fleet_supply"]),
  isFeatured: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  inHero: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  consignorId: z.preprocess(blank, z.uuid().optional()),
  locationId: z.preprocess(blank, z.uuid().optional()),
  description: optText(5000),
  features: z.preprocess(
    (v) =>
      [...new Set(String(v ?? "").split("\n").map((f) => f.trim()).filter(Boolean))],
    z.array(z.string().max(80, "Keep each feature under 80 characters")).max(40, "At most 40 features"),
  ),
});

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Every public page a vehicle change can affect. */
function refreshPublicPages(slug: string) {
  revalidatePath("/");
  revalidatePath(`/vehicles/${slug}`);
  revalidatePath("/vehicles");
  revalidatePath("/about"); // live stock count
  revalidatePath("/fleet"); // cover photo comes from the bus stock
  revalidatePath("/partners"); // commission examples use real prices
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/vehicles");
}

async function ownVehicle(me: StaffMember, vehicleId: string) {
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.dealerId, me.dealerId))).limit(1);
  return v ?? null;
}

async function uniqueSlug(dealerId: string, base: string, exceptId?: string): Promise<string> {
  const taken = new Set(
    (
      await db
        .select({ slug: vehicles.slug })
        .from(vehicles)
        .where(and(eq(vehicles.dealerId, dealerId), sql`${vehicles.slug} LIKE ${base + "%"}`, exceptId ? ne(vehicles.id, exceptId) : undefined))
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/* ── Save ──────────────────────────────────────────────────────────────── */

export async function saveVehicle(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Check this field"]));
    return { ok: false, error: "Some fields need attention.", fieldErrors };
  }
  const f = parsed.data;
  const before = f.id ? await ownVehicle(me, f.id) : null;
  if (f.id && !before) return { ok: false, error: "That vehicle no longer exists." };

  // Prices are for owners and managers. For anyone else the submitted figures
  // are ignored and the stored ones kept — the field is read-only in their form.
  const pricing = can.setPrices(me);
  const priceMinor = pricing ? (f.price ?? null) : (before?.priceMinor ?? null);
  const wasPriceMinor = pricing ? (f.wasPrice ?? null) : (before?.wasPriceMinor ?? null);
  if (wasPriceMinor && (!priceMinor || wasPriceMinor <= priceMinor)) {
    return { ok: false, error: "Some fields need attention.", fieldErrors: { wasPrice: "The previous price must be higher than the current price" } };
  }

  if (f.consignorId) {
    const [c] = await db.select({ id: consignors.id }).from(consignors).where(and(eq(consignors.id, f.consignorId), eq(consignors.dealerId, me.dealerId)));
    if (!c) return { ok: false, error: "That consignor is not on record." };
  }
  let locationId = f.locationId ?? before?.locationId ?? null;
  if (!locationId) {
    const [first] = await db.select({ id: locations.id }).from(locations).where(eq(locations.dealerId, me.dealerId)).orderBy(asc(locations.name)).limit(1);
    locationId = first?.id ?? null;
  }

  const now = new Date();
  const listed = f.status === "available" || f.status === "reserved";
  // A vehicle's address is fixed once it has been public: shared links and
  // search results must keep working. Until then it follows the details.
  const slug =
    before?.publishedAt ? before.slug : await uniqueSlug(me.dealerId, slugify(f.year, f.make, f.model), before?.id);

  const fields = {
    make: f.make,
    model: f.model,
    trim: f.trim ?? null,
    year: f.year,
    body: f.body ?? null,
    segment: f.segment,
    condition: f.condition,
    chassisNo: f.chassisNo ?? null,
    mileageKm: f.mileageKm ?? null,
    fuel: f.fuel ?? null,
    transmission: f.transmission ?? null,
    transmissionDetail: f.transmissionDetail ?? null,
    drivetrain: f.drivetrain ?? null,
    engine: f.engine ?? null,
    horsepower: f.horsepower ?? null,
    exteriorColour: f.exteriorColour ?? null,
    interiorColour: f.interiorColour ?? null,
    seats: f.seats ?? null,
    priceMinor,
    wasPriceMinor,
    status: f.status,
    badge: f.badge ?? null,
    isFeatured: f.isFeatured,
    inHero: f.inHero,
    ownerKind: f.consignorId ? ("consignor" as const) : ("dealer" as const),
    consignorId: f.consignorId ?? null,
    locationId,
    description: f.description ?? null,
    features: f.features,
    slug,
    // Sold keeps its original date if it already had one; leaving "sold" clears it.
    soldAt: f.status === "sold" ? (before?.soldAt ?? now) : null,
    publishedAt: before?.publishedAt ?? (listed ? now : null),
  };

  let id = before?.id;
  try {
    if (before) {
      const diff = changes(before as unknown as Record<string, unknown>, fields);
      if (Object.keys(diff).length === 0) return { ok: true, savedAt: Date.now() };
      await db.update(vehicles).set({ ...fields, updatedAt: now }).where(eq(vehicles.id, before.id));
      await audit(me, "vehicle", before.id, diff.status ? "status_change" : "update", diff);
      if (before.slug !== slug) revalidatePath(`/vehicles/${before.slug}`);
    } else {
      const [row] = await db.insert(vehicles).values({ ...fields, dealerId: me.dealerId }).returning({ id: vehicles.id });
      id = row.id;
      await audit(me, "vehicle", id, "create", { status: f.status, slug });
    }
  } catch (e) {
    console.error("[vehicles] save failed", e);
    return { ok: false, error: "The vehicle could not be saved. Please try again." };
  }

  refreshPublicPages(slug);
  // A new vehicle goes straight to its own page, where photos are added.
  if (!before) redirect(`/admin/vehicles/${id}?created=1`);
  return { ok: true, savedAt: Date.now() };
}

/* ── Photos ────────────────────────────────────────────────────────────── */

export async function photoUploadTicket(vehicleId: string): Promise<UploadTicket | { error: string }> {
  const me = await requireStaff();
  if (!(await ownVehicle(me, vehicleId))) return { error: "That vehicle no longer exists." };
  return uploadTicket(vehicleId);
}

/** Records a photo the browser has already uploaded to Cloudinary, after checking Cloudinary really stored it. */
export async function recordPhoto(vehicleId: string, asset: UploadedAsset): Promise<ActionResult> {
  const me = await requireStaff();
  const v = await ownVehicle(me, vehicleId);
  if (!v) return { ok: false, error: "That vehicle no longer exists." };
  if (!isGenuineUpload(asset, vehicleId)) return { ok: false, error: "That upload could not be verified. Please try again." };

  const [{ last }] = await db.select({ last: max(vehicleMedia.position) }).from(vehicleMedia).where(eq(vehicleMedia.vehicleId, vehicleId));
  const position = last === null ? 0 : last + 1;
  await db.insert(vehicleMedia).values({
    vehicleId,
    kind: "photo",
    url: asset.secure_url,
    cloudinaryPublicId: asset.public_id,
    position,
    width: asset.width ?? null,
    height: asset.height ?? null,
    alt: `${v.year} ${v.make} ${v.model}${position ? ` — photo ${position + 1}` : ""}`,
  });
  await audit(me, "vehicle", vehicleId, "photo_added", { publicId: asset.public_id });
  refreshPublicPages(v.slug);
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

/**
 * Puts the photos in the given order; the first becomes the cover.
 *
 * Positions are unique per vehicle, so they are first moved out of the way
 * (+10,000) and then assigned — inside one transaction, so a failure part-way
 * leaves the old order rather than a half-shuffled one.
 */
export async function reorderPhotos(vehicleId: string, orderedIds: string[]): Promise<ActionResult> {
  const me = await requireStaff();
  const v = await ownVehicle(me, vehicleId);
  if (!v) return { ok: false, error: "That vehicle no longer exists." };

  const current = await db.select({ id: vehicleMedia.id }).from(vehicleMedia).where(eq(vehicleMedia.vehicleId, vehicleId));
  const known = new Set(current.map((m) => m.id));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { ok: false, error: "The photos changed while you were reordering. Please reload." };
  }

  await db.transaction(async (tx) => {
    await tx.update(vehicleMedia).set({ position: sql`${vehicleMedia.position} + 10000` }).where(eq(vehicleMedia.vehicleId, vehicleId));
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(vehicleMedia).set({ position }).where(eq(vehicleMedia.id, id));
    }
  });
  await audit(me, "vehicle", vehicleId, "photos_reordered", { order: orderedIds });
  refreshPublicPages(v.slug);
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

/**
 * Takes a photo off the listing. The file is NOT deleted from Cloudinary: until
 * cutover the legacy site shows the same images, and a removal here must not
 * break a page there.
 */
export async function removePhoto(vehicleId: string, mediaId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const v = await ownVehicle(me, vehicleId);
  if (!v) return { ok: false, error: "That vehicle no longer exists." };

  const remaining = await db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(vehicleMedia)
      .where(and(eq(vehicleMedia.id, mediaId), eq(vehicleMedia.vehicleId, vehicleId)))
      .returning({ id: vehicleMedia.id, url: vehicleMedia.url });
    if (!gone) return null;
    // Close the gap so the cover is always position 0.
    const rest = await tx.select({ id: vehicleMedia.id }).from(vehicleMedia).where(eq(vehicleMedia.vehicleId, vehicleId)).orderBy(asc(vehicleMedia.position));
    await tx.update(vehicleMedia).set({ position: sql`${vehicleMedia.position} + 10000` }).where(eq(vehicleMedia.vehicleId, vehicleId));
    for (const [position, r] of rest.entries()) await tx.update(vehicleMedia).set({ position }).where(eq(vehicleMedia.id, r.id));
    return gone;
  });
  if (!remaining) return { ok: false, error: "That photo was already removed." };

  await audit(me, "vehicle", vehicleId, "photo_removed", { url: remaining.url });
  refreshPublicPages(v.slug);
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

/* ── Consignors ────────────────────────────────────────────────────────── */

const consignorSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  phone: optText(40),
  email: z.preprocess(blank, z.email("That email does not look right").optional()),
  country: optText(40),
  commissionPercent: z.preprocess(
    (v) => blank(typeof v === "string" ? v.replace("%", "") : v),
    z.coerce.number().min(0, "0 to 100").max(100, "0 to 100").optional(),
  ),
  notes: optText(1000),
});

export async function createConsignor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  if (!can.seeMoney(me)) return { ok: false, error: "Only an owner or manager can add consignors." };
  const parsed = consignorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, v?.[0] ?? "Check this field"]));
    return { ok: false, error: "Some fields need attention.", fieldErrors };
  }
  const c = parsed.data;
  const [row] = await db
    .insert(consignors)
    .values({
      dealerId: me.dealerId,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      country: c.country ?? null,
      // Stored in basis points: 10% is 1000.
      commissionBps: c.commissionPercent === undefined ? null : Math.round(c.commissionPercent * 100),
      notes: c.notes ?? null,
    })
    .returning({ id: consignors.id });
  await audit(me, "consignor", row.id, "create", { name: c.name });
  revalidatePath("/admin/consignors");
  return { ok: true, savedAt: Date.now() };
}

/* ── Status shortcuts from the list ────────────────────────────────────── */

export async function setVehicleStatus(vehicleId: string, status: "available" | "reserved" | "sold" | "unlisted"): Promise<ActionResult> {
  const me = await requireStaff();
  const v = await ownVehicle(me, vehicleId);
  if (!v) return { ok: false, error: "That vehicle no longer exists." };
  if (v.status === status) return { ok: true };
  const now = new Date();
  const next = {
    status,
    soldAt: status === "sold" ? (v.soldAt ?? now) : null,
    publishedAt: v.publishedAt ?? (status === "available" || status === "reserved" ? now : null),
  };
  await db.update(vehicles).set({ ...next, updatedAt: now }).where(eq(vehicles.id, vehicleId));
  await audit(me, "vehicle", vehicleId, "status_change", changes(v as unknown as Record<string, unknown>, next));
  refreshPublicPages(v.slug);
  return { ok: true };
}
