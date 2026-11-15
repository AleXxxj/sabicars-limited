import type { Metadata } from "next";
import { Heart, Search } from "lucide-react";
import Link from "@/components/IntentLink";
import { VehicleCard } from "@/components/VehicleCard";
import { AutoSubmitForm } from "@/components/inventory/AutoSubmitForm";
import { RecentlyViewed } from "@/components/saved/RecentlyViewed";
import { SavedList } from "@/components/saved/SavedList";
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

/** "?saved=1": the cars this visitor has saved, kept on their own device (lib/saved.ts), shown where the list would be. */
const savedViewIn = (raw: Record<string, string | string[] | undefined>) => raw.saved === "1";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = await searchParams;
  const f = parseFilters(raw);
  const title = `${headingFor(f)} for sale in Lagos`;
  // Only the filters that make a page worth landing on from a search: sort
  // order, page number and price bands are variations of it, not new pages.
  const canonical = filtersHref({ sort: "newest", page: 1, body: f.body, segment: f.segment, make: f.make }, {});
  return {
    title,
    description: `${title} from ${site.legalName} (RC ${site.rcNumber}), a CAC-registered dealer in Lagos, Nigeria. Every vehicle with photos, specifications and prices.`,
    ...pageAddress(canonical),
    // What one visitor typed, or saved on their own phone, is no page for a search engine; the cars' own pages are.
    ...((f.q || savedViewIn(raw)) && { robots: { index: false, follow: true } }),
  };
}

const box =
  "min-h-12 w-full rounded-xl border border-border-default bg-surface-1 px-4 text-sm text-text-primary outline-none transition-colors hover:border-border-strong focus:border-green-500";
const chevron = "appearance-none bg-[length:10px] bg-[right_1rem_center] bg-no-repeat pr-10";
const select = `${box} ${chevron}`;
/**
 * The down-arrow that says a box is a dropdown. A style, not a class: the arrow's picture was written as a Tailwind
 * class, whose spaces split it into pieces that drew nothing, so no arrow ever showed (the owner, 15 November 2026).
 */
const ARROW = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%239FA59E' stroke-width='1.4'/%3E%3C/svg%3E")`,
} as const;

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

/** The current filters as hidden fields, for a form that changes only one of them (the sort). */
function KeepFilters({ f, except }: { f: InventoryFilters; except: "sort" }) {
  const keep: [string, string | number | undefined][] = [
    ["body", f.body],
    ["segment", f.segment],
    ["make", f.make],
    ["condition", f.condition],
    ["price", priceValue(f) || undefined],
    ["maxDeposit", f.maxDeposit],
    ["q", f.q],
    ["sort", except === "sort" ? undefined : f.sort],
  ];
  return keep.map(([name, value]) => (value === undefined ? null : <input key={name} type="hidden" name={name} value={value} />));
}

export default async function InventoryPage({ searchParams }: Props) {
  const raw = await searchParams;
  const savedView = savedViewIn(raw);
  // The saved cars are shown as saved: no type, make, price or search narrows them, so none shows as chosen.
  const f = parseFilters(savedView ? {} : raw);
  const [result, sold] = await Promise.all([searchInventory(f), recentlySold()]);
  const cars = result.bodies.filter((b) => (CAR_BODIES as readonly string[]).includes(b.body)).reduce((n, b) => n + b.count, 0);

  return (
    <>
      <section className="border-b border-border-subtle">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 md:px-10 md:pt-20">
          <p className="kicker">Cars for sale</p>
          <h1 className="mt-4 text-display-2">{savedView ? "Cars you have saved" : headingFor(f)}</h1>
          {/* How many match, once the list is narrowed: "6 vehicles in stock" answers "SUVs under ₦30M?". Never the whole
              stock: the site names no total (the owner, 14 November 2026). A search says what it searched for. */}
          {hasActiveFilters(f) && (
            <p className="figures mt-4 text-text-secondary">
              {result.total} {result.total === 1 ? "vehicle" : "vehicles"} in stock
              {f.q && (
                <>
                  {" "}
                  {result.total === 1 ? "matches" : "match"} “{f.q}”
                </>
              )}
            </p>
          )}
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
            {/* The cars this visitor saved with the heart, first (the owner, 15 November 2026). They live on the phone,
                so they are shown by the phone (SavedList), with today's prices. */}
            <Chip href="/vehicles?saved=1" active={savedView}>
              <Heart aria-hidden size={15} strokeWidth={2} className={savedView ? "fill-current" : ""} />
              Saved
            </Chip>
            {/* "All" carries no number: on the plain list it would be the whole stock. Each type keeps its own. */}
            <Chip href={filtersHref(f, { body: undefined, segment: undefined })} active={!f.body && !f.segment && !savedView}>
              All
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

          {/* Keyed by the filters in the address: the selects are uncontrolled (defaultValue), and on a client-side
              move — Clear all filters, a page link, the browser's Back — React keeps the mounted controls, so a
              price that was cleared stayed selected while the list showed all 50 cars (audit, 8 November 2026).
              A new key remounts the form, and what the controls show is always what the results are. */}
          {/* Four boxes, edge to edge with the sort line and the cards; without JavaScript the Apply button takes a row of its own. */}
          <AutoSubmitForm key={filtersHref(f, {})} className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {f.body && <input type="hidden" name="body" value={f.body} />}
            {f.segment && <input type="hidden" name="segment" value={f.segment} />}
            {f.maxDeposit && <input type="hidden" name="maxDeposit" value={f.maxDeposit} />}
            {f.sort !== "newest" && <input type="hidden" name="sort" value={f.sort} />}
            <label>
              <span className="sr-only">Make</span>
              <select name="make" defaultValue={f.make ?? ""} className={select} style={ARROW}>
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
              <select name="price" defaultValue={priceValue(f)} className={select} style={ARROW}>
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
              <select name="condition" defaultValue={f.condition ?? ""} className={select} style={ARROW}>
                <option value="">Any condition</option>
                {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {/* The fourth box searches (the owner, 15 November 2026): a make, a model, a year, a budget ("under 15m"),
                "tokunbo" (lib/search-text.ts). It goes when the buyer taps Search or the keyboard's search key, not at
                every letter (AutoSubmitForm). The sort moved to a line above the list. */}
            <div className="relative">
              <label htmlFor="cars-search" className="sr-only">
                Search by make, model, year or budget
              </label>
              <input
                id="cars-search"
                type="search"
                name="q"
                defaultValue={f.q ?? ""}
                placeholder="Search"
                enterKeyHint="search"
                autoComplete="off"
                maxLength={60}
                className={`${box} pl-11`}
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute inset-y-0 left-0 inline-flex w-11 items-center justify-center rounded-l-xl text-text-muted transition-colors hover:text-text-primary"
              >
                <Search aria-hidden size={18} />
              </button>
            </div>
            {/* Only needed without JavaScript; with it, changing a field submits. */}
            <noscript>
              <button type="submit" className="min-h-12 w-full rounded-full bg-cta px-6 text-sm font-semibold text-cta-fg">
                Apply
              </button>
            </noscript>
          </AutoSubmitForm>

          {/* One short line under the boxes: Clear all filters on the left, the sort on the right (the owner, 15 November
              2026: Search took the sort's box). */}
          {(hasActiveFilters(f) || (!savedView && result.total > 1)) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {hasActiveFilters(f) ? (
                <Link href="/vehicles" className="inline-flex min-h-11 items-center text-sm font-medium text-text-muted underline-offset-4 hover:text-text-primary hover:underline">
                  Clear all filters
                </Link>
              ) : (
                <span />
              )}
              {!savedView && result.total > 1 && (
                <AutoSubmitForm key={`sort:${filtersHref(f, {})}`} className="flex items-center">
                  <KeepFilters f={f} except="sort" />
                  <label className="inline-flex items-center gap-2 text-sm text-text-muted">
                    Sort
                    <select
                      name="sort"
                      defaultValue={f.sort}
                      className={`${chevron} min-h-11 rounded-full border border-border-default bg-surface-1 pl-4 text-sm text-text-primary outline-none transition-colors hover:border-border-strong focus:border-green-500`}
                      style={ARROW}
                    >
                      {Object.entries(SORT_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <noscript>
                    <button type="submit" className="ml-2 min-h-11 rounded-full bg-cta px-4 text-sm font-semibold text-cta-fg">
                      Sort
                    </button>
                  </noscript>
                </AutoSubmitForm>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
        {savedView ? (
          <div id="saved">
            <SavedList />
          </div>
        ) : (
          <>
            {result.vehicles.length ? (
              <div id="results" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {result.vehicles.map((v, i) => (
                  <VehicleCard key={v.id} vehicle={v} href={`/vehicles/${v.slug}`} priority={i < 3} />
                ))}
              </div>
            ) : (
              <div className="border border-border-subtle bg-surface-1 px-6 py-16 text-center">
                <h2 className="text-display-3">{f.q ? <>Nothing matches “{f.q}”</> : "Nothing matches those filters"}</h2>
                <p className="mx-auto mt-4 max-w-md text-text-secondary">
                  {f.q ? "Try other words, or fewer filters" : "Try fewer filters"}, or request the car you want and we can look for it.
                </p>
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
          </>
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
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
