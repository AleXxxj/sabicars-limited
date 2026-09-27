import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { dealers, locations, settings, vehicleMedia, vehicles, type Vehicle, type VehicleMedia } from "@/db/schema";
import { CAR_BODIES, type InventoryFilters } from "@/lib/inventory-filters";
import { wantWords } from "@/lib/matching";
import { modelFamily, termFor, type Term } from "@/lib/seo/search-terms";
import { vehicleTitle } from "@/lib/vehicle";

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

/**
 * Exactly what a vehicle card shows, and nothing else. Anything sent to the
 * browser as data (not rendered on the server) goes through this: a vehicle
 * row also carries the chassis number, the consignor and the custodian.
 */
export type CardVehicle = Pick<
  Vehicle,
  "id" | "slug" | "year" | "make" | "model" | "priceMinor" | "status" | "badge" | "createdAt" | "condition" | "mileageKm" | "transmission" | "drivetrain" | "fuel"
> & { cover: VehicleWithCover["cover"] };

export function toCard(v: VehicleWithCover): CardVehicle {
  const { id, slug, year, make, model, priceMinor, status, badge, createdAt, condition, mileageKm, transmission, drivetrain, fuel, cover } = v;
  return { id, slug, year, make, model, priceMinor, status, badge, createdAt, condition, mileageKm, transmission, drivetrain, fuel, cover };
}

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

/* ── Homepage ──────────────────────────────────────────────────────────── */

/** Figures the homepage states as fact — all live, so none can drift out of date. */
export async function inventoryStats(): Promise<{ inStock: number; makes: number; fromMinor: number | null }> {
  const [row] = await db
    .select({
      inStock: count(),
      makes: sql<number>`count(DISTINCT ${vehicles.make})::int`,
      fromMinor: sql<number | null>`min(${vehicles.priceMinor})`,
    })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])));
  return { inStock: row.inStock, makes: row.makes, fromMinor: row.fromMinor === null ? null : Number(row.fromMinor) };
}

export interface CategoryTile {
  key: "cars" | "suvs" | "buses" | "trucks";
  label: string;
  href: string;
  count: number;
  coverUrl: string | null;
}

/**
 * Tile photographs chosen by eye (26 Sep 2026), because the best photo of a
 * category is rarely its newest car's cover: a clean saloon for cars, the
 * high roof that gives the Hummer bus its name, and the truck's best angle. Each
 * falls back to the automatic choice as soon as that vehicle is no longer
 * listed. Replace when better photography arrives (an admin control for this
 * belongs with the media work).
 */
const CURATED_COVERS: Partial<Record<CategoryTile["key"], { slug: string; position: number }>> = {
  cars: { slug: "2010-lexus-is-250-awd", position: 0 },
  buses: { slug: "2016-toyota-hiace-hummer-3", position: 1 },
  trucks: { slug: "2000-volvo-fl7", position: 3 },
};

/**
 * The four ways into the inventory, each with a real photograph and a live
 * count: cars, SUVs, buses (Hummers first) and trucks. Luxury is not a tile —
 * most luxury stock is SUVs, so the two tiles showed the same cars.
 */
export async function categoryTiles(): Promise<CategoryTile[]> {
  const dealerId = await sabicarsId();
  const isHummer = sql`${vehicles.model} ~* 'hum+er'`;
  const defs: { key: CategoryTile["key"]; label: string; href: string; where: SQL; prefer?: SQL }[] = [
    { key: "cars", label: "Cars", href: "/vehicles?body=car", where: inArray(vehicles.body, [...CAR_BODIES]) },
    { key: "suvs", label: "SUVs", href: "/vehicles?body=suv", where: eq(vehicles.body, "suv") },
    { key: "buses", label: "Buses & Hummer", href: "/vehicles?body=bus", where: eq(vehicles.body, "bus"), prefer: isHummer },
    { key: "trucks", label: "Trucks", href: "/vehicles?body=truck", where: eq(vehicles.body, "truck") },
  ];
  const candidates = await Promise.all(
    defs.map(async (d) => {
      const base = and(eq(vehicles.dealerId, dealerId), inArray(vehicles.status, [...LISTED]), d.where);
      const curated = CURATED_COVERS[d.key];
      const [[{ n }], covers, [pick]] = await Promise.all([
        db.select({ n: count() }).from(vehicles).where(base),
        // The best-merchandised vehicles in the category: featured first, then newest.
        db
          .select({ vehicleId: vehicles.id, url: vehicleMedia.url })
          .from(vehicles)
          .innerJoin(vehicleMedia, and(eq(vehicleMedia.vehicleId, vehicles.id), eq(vehicleMedia.position, 0)))
          .where(base)
          .orderBy(...(d.prefer ? [desc(d.prefer)] : []), desc(vehicles.isFeatured), desc(vehicles.createdAt))
          .limit(8),
        curated
          ? db
              .select({ vehicleId: vehicles.id, url: vehicleMedia.url })
              .from(vehicles)
              .innerJoin(vehicleMedia, and(eq(vehicleMedia.vehicleId, vehicles.id), eq(vehicleMedia.position, curated.position)))
              .where(and(base, eq(vehicles.slug, curated.slug)))
              .limit(1)
          : Promise.resolve([]),
      ]);
      return { ...d, count: n, covers: pick ? [pick, ...covers] : covers };
    }),
  );

  // A car can qualify for two tiles; each tile takes the best vehicle no
  // earlier tile has used, so no photograph appears twice.
  const used = new Set<string>();
  return candidates
    .filter((c) => c.count > 0)
    .map((c) => {
      const pick = c.covers.find((cv) => !used.has(cv.vehicleId)) ?? c.covers[0];
      if (pick) used.add(pick.vehicleId);
      return { key: c.key, label: c.label, href: c.href, count: c.count, coverUrl: pick?.url ?? null };
    });
}

export interface CatalogueItem {
  slug: string;
  title: string;
  priceMinor: number;
  coverUrl: string | null;
}

/**
 * Every vehicle a buyer can drive away today — available (not reserved) and
 * priced — cheapest first. Small enough to send whole to the browser, where
 * the Drive Plan finder answers "what can I afford?" as the buyer types.
 */
export async function drivePlanCatalogue(): Promise<CatalogueItem[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), eq(vehicles.status, "available"), sql`${vehicles.priceMinor} IS NOT NULL`))
    .orderBy(asc(vehicles.priceMinor));
  return (await withCovers(rows)).map((v) => ({
    slug: v.slug,
    title: vehicleTitle(v),
    priceMinor: v.priceMinor!,
    coverUrl: v.cover?.url ?? null,
  }));
}

/** The same catalogue with the shape of each car, for the article quiz that matches cars to a reader's needs. */
export async function catalogueWithShape(): Promise<(CatalogueItem & { body: string | null; segment: string; make: string })[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), eq(vehicles.status, "available"), sql`${vehicles.priceMinor} IS NOT NULL`))
    .orderBy(asc(vehicles.priceMinor));
  return (await withCovers(rows)).map((v) => ({
    slug: v.slug,
    title: vehicleTitle(v),
    priceMinor: v.priceMinor!,
    coverUrl: v.cover?.url ?? null,
    body: v.body,
    segment: v.segment,
    make: v.make,
  }));
}

/**
 * In-stock vehicles that satisfy a Sourcing Desk request — the same rule as
 * lib/matching.ts, expressed in SQL so it runs over the whole inventory.
 */
export async function stockMatching(want: string, yearFrom: number | null, budgetMaxMinor: number | null, limit = 4): Promise<VehicleWithCover[]> {
  const words = wantWords(want);
  if (!words.length) return [];
  const name = sql`(${vehicles.make} || ' ' || ${vehicles.model})`;
  const rows = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.dealerId, await sabicarsId()),
        inArray(vehicles.status, [...LISTED]),
        ...words.map((w) => sql`${name} ILIKE ${`%${w}%`}`),
        yearFrom ? gte(vehicles.year, yearFrom) : undefined,
        budgetMaxMinor ? lte(vehicles.priceMinor, budgetMaxMinor) : undefined,
      ),
    )
    .orderBy(desc(vehicles.year), asc(vehicles.priceMinor))
    .limit(limit);
  return withCovers(rows);
}

/**
 * The Toyota Hiace high-roof — the "Hummer bus" (spelt "Humer" in some
 * listings) — Sabicars' signature vehicle, then any other Hiace. Hummers first.
 */
export async function hummerBuses(): Promise<VehicleWithCover[]> {
  const isHummer = sql`${vehicles.model} ~* 'hum+er'`;
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED]), sql`(${isHummer} OR ${vehicles.model} ILIKE '%hiace%')`))
    .orderBy(desc(isHummer), desc(vehicles.year), asc(vehicles.priceMinor));
  return withCovers(rows);
}

/**
 * What Sabicars sold lately — proof that stock moves and that buyers trust
 * the showroom. Only the last 90 days, so it never shows a stale list.
 */
export async function recentlySold(limit = 6): Promise<CardVehicle[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), eq(vehicles.status, "sold"), gte(vehicles.soldAt, new Date(Date.now() - 90 * 86_400_000))))
    .orderBy(desc(vehicles.soldAt))
    .limit(limit);
  return (await withCovers(rows)).map(toCard);
}

/** Vehicles on a visitor's shortlist, in the order they saved them. Sold cars stay, marked sold. */
export async function vehiclesBySlugs(slugs: string[]): Promise<VehicleWithCover[]> {
  if (!slugs.length) return [];
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.slug, slugs), inArray(vehicles.status, [...HAS_PAGE])));
  const order = new Map(slugs.map((s, i) => [s, i]));
  return withCovers(rows.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)));
}

/* ── Search landing pages ─────────────────────────────────────────────── */

export interface TermStock extends Term {
  inStock: number;
  fromMinor: number | null;
}

/**
 * Every make and model family Sabicars has sold or is selling, with what is in
 * stock now. A family that sells out keeps its page (people still search for
 * it, and the Sourcing Desk can take the request) but leaves the sitemap.
 */
export const searchTerms = cache(async (): Promise<TermStock[]> => {
  const rows = await db
    .select({ make: vehicles.make, model: vehicles.model, status: vehicles.status, priceMinor: vehicles.priceMinor })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...HAS_PAGE])));
  const terms = new Map<string, TermStock>();
  for (const r of rows) {
    for (const t of [termFor(r.make, null), termFor(r.make, modelFamily(r.make, r.model))]) {
      const entry = terms.get(t.slug) ?? { ...t, inStock: 0, fromMinor: null };
      if (r.status !== "sold") {
        entry.inStock++;
        if (r.priceMinor && (entry.fromMinor === null || r.priceMinor < entry.fromMinor)) entry.fromMinor = r.priceMinor;
      }
      terms.set(t.slug, entry);
    }
  }
  return [...terms.values()].sort((a, b) => b.inStock - a.inStock || a.label.localeCompare(b.label));
});

/** The listed vehicles a search term covers, newest first. */
export async function vehiclesForTerm(term: Term): Promise<VehicleWithCover[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED]), eq(vehicles.make, term.make)))
    .orderBy(desc(vehicles.isFeatured), desc(vehicles.year), asc(vehicles.priceMinor));
  const matching = term.family ? rows.filter((v) => modelFamily(v.make, v.model) === term.family) : rows;
  return withCovers(matching);
}

/** Every listed vehicle with all its photographs, for the sitemap (Google Images reads them from there). */
export async function sitemapVehicles(): Promise<{ slug: string; updatedAt: Date; photos: string[] }[]> {
  const rows = await db
    .select({ slug: vehicles.slug, updatedAt: vehicles.updatedAt, url: vehicleMedia.url, position: vehicleMedia.position })
    .from(vehicles)
    .leftJoin(vehicleMedia, and(eq(vehicleMedia.vehicleId, vehicles.id), eq(vehicleMedia.kind, "photo")))
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])))
    .orderBy(vehicles.slug, vehicleMedia.position);
  const bySlug = new Map<string, { slug: string; updatedAt: Date; photos: string[] }>();
  for (const r of rows) {
    const entry = bySlug.get(r.slug) ?? { slug: r.slug, updatedAt: r.updatedAt, photos: [] };
    if (r.url) entry.photos.push(r.url);
    bySlug.set(r.slug, entry);
  }
  return [...bySlug.values()];
}

/** What the Drive Plan button needs about a vehicle a buyer can still buy. */
export async function vehicleForDrivePlan(id: string): Promise<{ id: string; dealerId: string; slug: string; title: string; autochekUrl: string | null } | null> {
  const [v] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])))
    .limit(1);
  return v ? { id: v.id, dealerId: v.dealerId, slug: v.slug, title: vehicleTitle(v), autochekUrl: v.autochekUrl } : null;
}

/** The homepage hero video, when staff have set one (YouTube link or direct video file). */
export async function heroVideoUrl(): Promise<string | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.dealerId, await sabicarsId()), eq(settings.key, "hero_video_url")))
    .limit(1);
  return typeof row?.value === "string" && row.value.trim() ? row.value.trim() : null;
}

/* ── Inventory search ──────────────────────────────────────────────────── */

type Facet = "make" | "body" | "segment";

function filterConditions(dealerId: string, f: InventoryFilters, omit: Facet[] = []): SQL[] {
  const where: SQL[] = [eq(vehicles.dealerId, dealerId), inArray(vehicles.status, [...LISTED])];
  if (f.body && !omit.includes("body")) where.push(f.body === "car" ? inArray(vehicles.body, [...CAR_BODIES]) : eq(vehicles.body, f.body));
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

/**
 * Everything on sale, cheapest first, with covers: what Ask Sabicars knows and
 * the pool comparisons are drawn from. Full rows — server-side only; anything
 * sent to a browser goes through a narrower shape.
 */
export async function listedVehicles(): Promise<VehicleWithCover[]> {
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])))
    .orderBy(sql`${vehicles.priceMinor} asc nulls last`, asc(vehicles.slug));
  return withCovers(rows);
}

/** Vehicles by slug that still have a page (listed or sold), in the order asked. */
export async function vehiclesWithPages(slugs: string[]): Promise<VehicleWithCover[]> {
  if (!slugs.length) return [];
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.slug, slugs), inArray(vehicles.status, [...HAS_PAGE])));
  const found = await withCovers(rows);
  return slugs.map((s) => found.find((v) => v.slug === s)).filter((v): v is VehicleWithCover => Boolean(v));
}

/** Every vehicle address to offer search engines and to pre-render at build. */
export async function listedVehicleSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: vehicles.slug, updatedAt: vehicles.updatedAt })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, await sabicarsId()), inArray(vehicles.status, [...LISTED])));
}
