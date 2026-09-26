import type { Metadata } from "next";
import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import { AutoSubmitForm } from "@/components/inventory/AutoSubmitForm";
import { searchInventory } from "@/lib/repositories/vehicles";
import {
  customPriceLabel,
  filtersHref,
  hasActiveFilters,
  parseFilters,
  PRICE_BANDS,
  priceValue,
  SORT_LABEL,
  type InventoryFilters,
} from "@/lib/inventory-filters";
import { BODY_LABEL, CONDITION_LABEL } from "@/lib/vehicle";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PLURAL: Partial<Record<string, string>> = { bus: "Buses", suv: "SUVs", truck: "Trucks", sedan: "Sedans", van: "Vans", pickup: "Pickups", coupe: "Coupes" };

/** "Luxury Lexus SUVs" — the heading reads the way a buyer would say it. */
function headingFor(f: InventoryFilters): string {
  const noun = f.body ? PLURAL[f.body] ?? BODY_LABEL[f.body] : "vehicles";
  const words = [f.segment === "luxury" ? "Luxury" : f.segment === "commercial" ? "Commercial" : null, f.make, noun].filter(Boolean);
  const phrase = words.join(" ");
  return f.body || f.segment || f.make ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : "Verified vehicles";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  const title = `${headingFor(f)} for sale in Lagos`;
  // Only the filters that make a page worth landing on from a search: sort
  // order, page number and price bands are variations of it, not new pages.
  const canonical = filtersHref({ sort: "newest", page: 1, body: f.body, segment: f.segment, make: f.make }, {});
  return {
    title,
    description: `${title} from Sabicars Limited (RC 1560100), a CAC-registered dealer in Lagos, Nigeria. Every vehicle with photos, specifications and prices.`,
    alternates: { canonical },
  };
}

const select =
  "min-h-12 w-full appearance-none border border-border-default bg-surface-1 bg-[length:10px] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-sm text-text-primary outline-none transition-colors hover:border-border-strong focus:border-gold-500 " +
  "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 6%22><path d=%22M1 1l4 4 4-4%22 fill=%22none%22 stroke=%22%23A39B8B%22 stroke-width=%221.4%22/></svg>')]";

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 border px-4 text-[0.72rem] font-semibold uppercase tracking-[0.16em] [font-stretch:112%] transition-colors duration-[var(--duration-fast)] ${
        active ? "border-gold-500 bg-gold-500 text-[#0B0A09]" : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function InventoryPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const result = await searchInventory(f);

  return (
    <>
      <section className="border-b border-border-subtle">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 md:px-10 md:pt-20">
          <p className="kicker">Inventory</p>
          <h1 className="mt-4 text-display-2">{headingFor(f)}</h1>
          <p className="figures mt-4 text-text-secondary">
            {result.total} {result.total === 1 ? "vehicle" : "vehicles"} in stock
          </p>

          {/* Shape first: it is how most buyers start ("I need a bus"). */}
          <nav aria-label="Vehicle type" className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            <Chip href={filtersHref(f, { body: undefined, segment: undefined })} active={!f.body && !f.segment}>
              All <span className="figures opacity-70">{result.allTypesCount}</span>
            </Chip>
            <Chip href={filtersHref(f, { segment: f.segment === "luxury" ? undefined : "luxury", body: undefined })} active={f.segment === "luxury"}>
              Luxury
            </Chip>
            {result.bodies.map((b) => (
              <Chip key={b.body} href={filtersHref(f, { body: f.body === b.body ? undefined : b.body, segment: undefined })} active={f.body === b.body}>
                {PLURAL[b.body] ?? BODY_LABEL[b.body]} <span className="figures opacity-70">{b.count}</span>
              </Chip>
            ))}
          </nav>

          <AutoSubmitForm className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            {f.body && <input type="hidden" name="body" value={f.body} />}
            {f.segment && <input type="hidden" name="segment" value={f.segment} />}
            <label>
              <span className="sr-only">Make</span>
              <select name="make" defaultValue={f.make ?? ""} className={select}>
                <option value="">All makes</option>
                {result.makes.map((m) => (
                  <option key={m.make} value={m.make}>
                    {m.make} ({m.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Price</span>
              <select name="price" defaultValue={priceValue(f)} className={select}>
                <option value="">Any price</option>
                {PRICE_BANDS.map((b) => (
                  <option key={b.label} value={`${b.min ?? ""}-${b.max ?? ""}`}>
                    {b.label}
                  </option>
                ))}
                {/* A range from a link (e.g. the Drive Plan finder's "up to ₦25m") that no band matches: show it, don't pretend it's "Any price". */}
                {priceValue(f) && !PRICE_BANDS.some((b) => `${b.min ?? ""}-${b.max ?? ""}` === priceValue(f)) && (
                  <option value={priceValue(f)}>{customPriceLabel(f)}</option>
                )}
              </select>
            </label>
            <label>
              <span className="sr-only">Condition</span>
              <select name="condition" defaultValue={f.condition ?? ""} className={select}>
                <option value="">Any condition</option>
                {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort by</span>
              <select name="sort" defaultValue={f.sort} className={select}>
                {Object.entries(SORT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {/* Only needed without JavaScript; with it, changing a field submits. */}
            <noscript>
              <button type="submit" className="min-h-12 w-full bg-cta px-6 text-xs font-semibold uppercase tracking-[0.18em] text-cta-fg">
                Apply
              </button>
            </noscript>
          </AutoSubmitForm>

          {hasActiveFilters(f) && (
            <Link href="/vehicles" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-text-muted underline-offset-4 hover:text-text-primary hover:underline">
              Clear all filters
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
        {result.vehicles.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.vehicles.map((v, i) => (
              <VehicleCard key={v.id} vehicle={v} href={`/vehicles/${v.slug}`} priority={i < 3} />
            ))}
          </div>
        ) : (
          <div className="border border-border-subtle bg-surface-1 px-6 py-16 text-center">
            <h2 className="text-display-3">Nothing matches those filters</h2>
            <p className="mx-auto mt-4 max-w-md text-text-secondary">
              Try fewer filters — or tell us what you are looking for, and Sabicars can source it.
            </p>
            <Link href="/vehicles" className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-gold-300 hover:text-gold-200 mt-6">
              See all vehicles →
            </Link>
          </div>
        )}

        {result.pages > 1 && (
          <nav aria-label="Pages" className="mt-14 flex items-center justify-between border-t border-border-subtle pt-6">
            {result.page > 1 ? (
              <Link href={filtersHref(f, { page: result.page - 1 })} className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-gold-300 hover:text-gold-200">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="figures text-sm text-text-muted">
              Page {result.page} of {result.pages}
            </span>
            {result.page < result.pages ? (
              <Link href={filtersHref(f, { page: result.page + 1 })} className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-gold-300 hover:text-gold-200">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
