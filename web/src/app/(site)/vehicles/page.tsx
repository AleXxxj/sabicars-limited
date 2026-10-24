import type { Metadata } from "next";
import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import { AutoSubmitForm } from "@/components/inventory/AutoSubmitForm";
import { RecentlyViewed } from "@/components/saved/RecentlyViewed";
import { recentlySold, searchInventory } from "@/lib/repositories/vehicles";
import {
  CAR_BODIES,
  customPriceLabel,
  filtersHref,
  hasActiveFilters,
  parseFilters,
  PRICE_BANDS,
  priceValue,
  SORT_LABEL,
  type InventoryFilters,
} from "@/lib/inventory-filters";
import { DRIVE_PLAN } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";
import { pageAddress, site } from "@/lib/site";
import { BODY_LABEL, CONDITION_LABEL } from "@/lib/vehicle";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PLURAL: Partial<Record<string, string>> = { car: "Saloon cars", bus: "Buses", suv: "SUVs", truck: "Trucks", sedan: "Sedans", van: "Vans", pickup: "Pickups", coupe: "Coupes" };

/** "Luxury Lexus SUVs" — the heading reads the way a buyer would say it. */
function headingFor(f: InventoryFilters): string {
  const noun = f.body ? (PLURAL[f.body] ?? BODY_LABEL[f.body as keyof typeof BODY_LABEL]) : "vehicles";
  const words = [f.segment === "luxury" ? "Luxury" : f.segment === "commercial" ? "Commercial" : null, f.make, noun].filter(Boolean);
  const phrase = words.join(" ");
  return f.body || f.segment || f.make ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : "Cars, SUVs, buses and trucks";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  const title = `${headingFor(f)} for sale in Lagos`;
  // Only the filters that make a page worth landing on from a search: sort
  // order, page number and price bands are variations of it, not new pages.
  const canonical = filtersHref({ sort: "newest", page: 1, body: f.body, segment: f.segment, make: f.make }, {});
  return {
    title,
    description: `${title} from ${site.legalName} (RC ${site.rcNumber}), a CAC-registered dealer in Lagos, Nigeria. Every vehicle with photos, specifications and prices.`,
    ...pageAddress(canonical),
  };
}

const select =
  "min-h-12 w-full appearance-none rounded-xl border border-border-default bg-surface-1 bg-[length:10px] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-sm text-text-primary outline-none transition-colors hover:border-border-strong focus:border-green-500 " +
  "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 6%22><path d=%22M1 1l4 4 4-4%22 fill=%22none%22 stroke=%22%239FA59E%22 stroke-width=%221.4%22/></svg>')]";

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-[var(--duration-fast)] ${
        active
          ? "border-green-400 bg-green-500/15 text-green-100"
          : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function InventoryPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const [result, sold] = await Promise.all([searchInventory(f), recentlySold()]);
  const cars = result.bodies.filter((b) => (CAR_BODIES as readonly string[]).includes(b.body)).reduce((n, b) => n + b.count, 0);

  return (
    <>
      <section className="border-b border-border-subtle">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 md:px-10 md:pt-20">
          <p className="kicker">Cars for sale</p>
          <h1 className="mt-4 text-display-2">{headingFor(f)}</h1>
          <p className="figures mt-4 text-text-secondary">
            {result.total} {result.total === 1 ? "vehicle" : "vehicles"} in stock
          </p>
          {f.maxDeposit && (
            // From the Drive Plan finder: say what this list is, since no dropdown shows it.
            <p className="mt-2 text-sm text-text-secondary">
              On the Drive Plan with up to <span className="figures text-text-primary">{formatNaira(f.maxDeposit * 100)}</span> down — each car at its own
              deposit, 40% from {DRIVE_PLAN.standardYear} and 50% on a {DRIVE_PLAN.minYear} or {DRIVE_PLAN.standardYear - 1} car.{" "}
              <Link href="/drive-plan" className="text-green-300 underline-offset-4 hover:underline">
                How the plan works
              </Link>
            </p>
          )}

          {/* Shape first: it is how most buyers start ("I need a bus"). */}
          <nav aria-label="Vehicle type" className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            <Chip href={filtersHref(f, { body: undefined, segment: undefined })} active={!f.body && !f.segment}>
              All <span className="figures opacity-70">{result.allTypesCount}</span>
            </Chip>
            <Chip href={filtersHref(f, { segment: f.segment === "luxury" ? undefined : "luxury", body: undefined })} active={f.segment === "luxury"}>
              Luxury
            </Chip>
            {/* Saloons, coupés and the like are one chip, "Saloon cars" — the name the footer uses for it too.
                Plain "Cars" would read as the whole page, which is "Cars for sale". */}
            {cars > 0 && (
              <Chip href={filtersHref(f, { body: f.body === "car" ? undefined : "car", segment: undefined })} active={f.body === "car"}>
                Saloon cars <span className="figures opacity-70">{cars}</span>
              </Chip>
            )}
            {result.bodies
              .filter((b) => !(CAR_BODIES as readonly string[]).includes(b.body))
              .map((b) => (
                <Chip key={b.body} href={filtersHref(f, { body: f.body === b.body ? undefined : b.body, segment: undefined })} active={f.body === b.body}>
                  {PLURAL[b.body] ?? BODY_LABEL[b.body]} <span className="figures opacity-70">{b.count}</span>
                </Chip>
              ))}
          </nav>

          <AutoSubmitForm className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            {f.body && <input type="hidden" name="body" value={f.body} />}
            {f.segment && <input type="hidden" name="segment" value={f.segment} />}
            {f.maxDeposit && <input type="hidden" name="maxDeposit" value={f.maxDeposit} />}
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
              <button type="submit" className="min-h-12 w-full rounded-full bg-cta px-6 text-sm font-semibold text-cta-fg">
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
            <p className="mx-auto mt-4 max-w-md text-text-secondary">Try fewer filters, or request the car you want and we can look for it.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href="/find" className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-green-300 hover:text-green-200">
                Request a car →
              </Link>
              <Link href="/vehicles" className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-green-300 hover:text-green-200">
                See all cars for sale →
              </Link>
            </div>
          </div>
        )}

        {result.pages > 1 && (
          <nav aria-label="Pages" className="mt-14 flex items-center justify-between border-t border-border-subtle pt-6">
            {result.page > 1 ? (
              <Link href={filtersHref(f, { page: result.page - 1 })} className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-green-300 hover:text-green-200">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="figures text-sm text-text-muted">
              Page {result.page} of {result.pages}
            </span>
            {result.page < result.pages ? (
              <Link href={filtersHref(f, { page: result.page + 1 })} className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-green-300 hover:text-green-200">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        <RecentlyViewed className="mt-20 border-t border-border-subtle pt-14" />

        {sold.length > 0 && (
          <section aria-labelledby="recently-sold" className="mt-20 border-t border-border-subtle pt-14">
            <p id="recently-sold" className="kicker">
              Recently sold
            </p>
            <h2 className="mt-3 text-display-3">Already sold.</h2>
            <p className="mt-3 max-w-xl text-text-secondary">
              Missed one?{" "}
              <Link href="/find" className="text-green-300 underline-offset-4 hover:underline">
                Request a car
              </Link>{" "}
              and we will tell you if a similar one arrives.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sold.map((v) => (
                <VehicleCard key={v.id} vehicle={v} href={`/vehicles/${v.slug}`} />
              ))}
            </div>
          </section>
        )}
      </section>
    </>
  );
}
