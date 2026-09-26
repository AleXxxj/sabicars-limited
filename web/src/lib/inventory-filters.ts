import { z } from "zod";

/**
 * Inventory filters live in the URL, so any view — "Toyota buses under ₦40m" —
 * can be bookmarked, shared on WhatsApp, and crawled. Anything malformed is
 * dropped rather than erroring: a mistyped link should still show cars.
 */

const BODIES = ["car", "sedan", "suv", "bus", "van", "pickup", "truck", "coupe", "hatchback", "wagon", "convertible", "other"] as const;

/**
 * "car" is how buyers say it: every passenger car that is not an SUV — saloons,
 * coupés, hatchbacks, estates, convertibles. It is a filter, not a body type.
 */
export const CAR_BODIES = ["sedan", "coupe", "hatchback", "wagon", "convertible"] as const;
const SORTS = ["newest", "price_asc", "price_desc", "year_desc"] as const;

const naira = z.coerce.number().int().positive().max(10_000_000_000);

const schema = z.object({
  body: z.enum(BODIES).optional().catch(undefined),
  segment: z.enum(["standard", "luxury", "commercial"]).optional().catch(undefined),
  make: z.string().trim().min(1).max(40).optional().catch(undefined),
  condition: z.enum(["foreign_used", "nigerian_used", "brand_new"]).optional().catch(undefined),
  /** Whole naira, not kobo — this is what a person types or a link carries. */
  minPrice: naira.optional().catch(undefined),
  maxPrice: naira.optional().catch(undefined),
  sort: z.enum(SORTS).catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});

export type InventoryFilters = z.infer<typeof schema>;

export const SORT_LABEL: Record<InventoryFilters["sort"], string> = {
  newest: "Newest listings",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  year_desc: "Year: newest first",
};

/** Price bands in naira, chosen for how Nigerian buyers actually budget. */
export const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Under ₦20m", max: 20_000_000 },
  { label: "₦20m – ₦40m", min: 20_000_000, max: 40_000_000 },
  { label: "₦40m – ₦80m", min: 40_000_000, max: 80_000_000 },
  { label: "₦80m – ₦150m", min: 80_000_000, max: 150_000_000 },
  { label: "Over ₦150m", min: 150_000_000 },
];

type Raw = Record<string, string | string[] | undefined>;

export function parseFilters(raw: Raw): InventoryFilters {
  const flat: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== ""),
  );
  // The price dropdown sends one value, "min-max" (either side may be empty).
  if (flat.price) {
    const [min, max] = flat.price.split("-");
    flat.minPrice ??= min || undefined;
    flat.maxPrice ??= max || undefined;
    delete flat.price;
  }
  return schema.parse(flat);
}

/** A price range no band matches, in words: "Up to ₦25m", "From ₦8m", "₦8m – ₦25m". */
export function customPriceLabel(f: InventoryFilters): string {
  const m = (n: number) => `₦${Number((n / 1_000_000).toFixed(1))}m`;
  if (f.minPrice && f.maxPrice) return `${m(f.minPrice)} – ${m(f.maxPrice)}`;
  return f.maxPrice ? `Up to ${m(f.maxPrice)}` : `From ${m(f.minPrice ?? 0)}`;
}

/** The price dropdown's value for the current filters: "min-max". */
export function priceValue(f: InventoryFilters): string {
  return f.minPrice || f.maxPrice ? `${f.minPrice ?? ""}-${f.maxPrice ?? ""}` : "";
}

/** The URL for the current filters with some changed. Changing a filter always returns to page 1. */
export function filtersHref(current: InventoryFilters, change: Partial<Record<keyof InventoryFilters, string | number | undefined>>): string {
  const next: Record<string, string | number | undefined> = { ...current, page: undefined, ...change };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "sort" && v === "newest") continue;
    if (k === "page" && Number(v) === 1) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `/vehicles?${qs}` : "/vehicles";
}

export function hasActiveFilters(f: InventoryFilters): boolean {
  return Boolean(f.body || f.segment || f.make || f.condition || f.minPrice || f.maxPrice);
}
