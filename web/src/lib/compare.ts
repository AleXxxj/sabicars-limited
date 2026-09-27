import "server-only";
import { cache } from "react";
import { comparePath } from "@/lib/assistant/parts";
import { formatNaira } from "@/lib/money";
import { listedVehicles, type VehicleWithCover } from "@/lib/repositories/vehicles";
import { BODY_LABEL, DRIVE_PLAN_DEPOSIT_BPS, DRIVETRAIN_LABEL, vehicleTitle } from "@/lib/vehicle";

/**
 * Side-by-side comparisons: one page for every pair (or three) of cars.
 *
 * Ask Sabicars links to them, and every vehicle page links to comparisons
 * with its closest rivals — so search engines find a page for "Highlander vs
 * Ford Edge" that Sabicars can actually sell, with the verdict worked out from
 * the recorded facts rather than written by hand.
 */

/** "/compare/a-vs-b" → ["a", "b"]; null when the address is not a comparison. */
export function slugsFromPair(pair: string): string[] | null {
  const slugs = pair.split("-vs-");
  if (slugs.length < 2 || slugs.length > 3) return null;
  if (!slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))) return null;
  if (new Set(slugs).size !== slugs.length) return null;
  return slugs;
}

const short = (v: VehicleWithCover) => `the ${v.model}`;
const deposit = (v: VehicleWithCover) => (v.priceMinor ? Math.round((v.priceMinor * DRIVE_PLAN_DEPOSIT_BPS) / 10_000) : null);

/** Millions, as buyers say them: "₦5.5m". */
function millions(minor: number): string {
  const m = minor / 100 / 1_000_000;
  return `₦${m >= 10 ? Math.round(m) : Number(m.toFixed(1))}m`;
}

function joinNames(vs: VehicleWithCover[]): string {
  const names = vs.map(short);
  return names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The facts that separate the cars, in plain sentences — only from what is recorded. */
export function differences(cars: VehicleWithCover[]): string[] {
  const out: string[] = [];
  const priced = cars.filter((c) => c.priceMinor);
  if (priced.length === cars.length) {
    const sorted = [...priced].sort((a, b) => a.priceMinor! - b.priceMinor!);
    const [low, high] = [sorted[0], sorted.at(-1)!];
    const gap = high.priceMinor! - low.priceMinor!;
    if (gap > 0)
      out.push(
        `${cap(short(low))} is ${millions(gap)} cheaper than ${short(high)} — ${formatNaira(deposit(high)! - deposit(low)!)} less to put down on the 40% Drive Plan.`,
      );
    else out.push(`They are the same price: ${formatNaira(low.priceMinor!)}.`);
  }
  const years = [...cars].sort((a, b) => b.year - a.year);
  const yearGap = years[0].year - years.at(-1)!.year;
  if (yearGap > 0)
    out.push(
      `${cap(short(years[0]))} is the newest, a ${years[0].year} — ${yearGap} year${yearGap === 1 ? "" : "s"} younger than ${short(years.at(-1)!)}.`,
    );
  else out.push(`All are ${years[0].year} models.`);

  const withKm = cars.filter((c) => c.mileageKm);
  if (withKm.length === cars.length) {
    const km = [...withKm].sort((a, b) => a.mileageKm! - b.mileageKm!);
    if (km.at(-1)!.mileageKm! - km[0].mileageKm! >= 5000)
      out.push(
        `${cap(short(km[0]))} has covered the least: ${km[0].mileageKm!.toLocaleString("en-NG")} km, against ${km.at(-1)!.mileageKm!.toLocaleString("en-NG")} km.`,
      );
  }
  const withSeats = cars.filter((c) => c.seats);
  if (withSeats.length === cars.length && new Set(withSeats.map((c) => c.seats)).size > 1) {
    out.push(`Seating: ${cars.map((c) => `${short(c)} ${c.seats}`).join(", ")}.`);
  }
  const same = (f: (c: VehicleWithCover) => string | null) => {
    const vals = cars.map(f);
    return vals.every((v) => v && v === vals[0]) ? vals[0] : null;
  };
  const shared = [
    same((c) => (c.drivetrain ? DRIVETRAIN_LABEL[c.drivetrain] : null)),
    same((c) => c.fuel),
    same((c) => (c.transmission === "automatic" ? "automatic" : c.transmission === "manual" ? "manual" : null)),
  ].filter(Boolean);
  if (shared.length) out.push(`${cars.length === 2 ? "Both" : "All"} are ${shared.join(", ")}.`);
  return out;
}

/** Who each car suits, from where it wins. */
export function suits(cars: VehicleWithCover[]): { car: VehicleWithCover; reasons: string[] }[] {
  const best = <T>(pick: (c: VehicleWithCover) => T | null, better: (a: T, b: T) => boolean) => {
    const stated = cars.filter((c) => pick(c) !== null);
    if (stated.length < 2) return null;
    const top = stated.reduce((a, b) => (better(pick(b)!, pick(a)!) ? b : a));
    return stated.filter((c) => pick(c) === pick(top)).length === 1 ? top : null;
  };
  const cheapest = best(
    (c) => c.priceMinor,
    (a, b) => a < b,
  );
  const newest = best(
    (c) => c.year,
    (a, b) => a > b,
  );
  const leastKm = best(
    (c) => c.mileageKm,
    (a, b) => a < b,
  );
  const mostSeats = best(
    (c) => c.seats,
    (a, b) => a > b,
  );
  const mostPower = best(
    (c) => c.horsepower,
    (a, b) => a > b,
  );
  return cars.map((car) => ({
    car,
    reasons: [
      cheapest === car ? "the budget matters most" : null,
      newest === car ? "you want the newer car" : null,
      leastKm === car ? "low mileage matters to you" : null,
      mostSeats === car ? "you carry more people" : null,
      mostPower === car ? "you want the most power" : null,
      car.segment === "luxury" && cars.some((c) => c.segment !== "luxury") ? "you want the premium badge" : null,
    ].filter((r): r is string => Boolean(r)),
  }));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function compareTitle(cars: VehicleWithCover[]): string {
  return cars.map(vehicleTitle).join(" vs ");
}

export function compareSummary(cars: VehicleWithCover[]): string {
  return `${cap(joinNames(cars))} side by side: price, 40% deposit, age, mileage, engine and seats — and which one suits you.`;
}

export interface ComparisonLink {
  path: string;
  title: string;
  body: string;
}

/**
 * The comparisons worth a page: each car against its two closest rivals of
 * the same body, by price. Deduplicated, so a pair appears once.
 */
export const comparisonPairs = cache(async (): Promise<ComparisonLink[]> => {
  const stock = (await listedVehicles()).filter((v) => v.priceMinor && v.body);
  const seen = new Map<string, ComparisonLink>();
  for (const v of stock) {
    const rivals = stock
      .filter((o) => o.id !== v.id && o.body === v.body && `${o.make} ${o.model}` !== `${v.make} ${v.model}`)
      .sort((a, b) => Math.abs(a.priceMinor! - v.priceMinor!) - Math.abs(b.priceMinor! - v.priceMinor!))
      .slice(0, 2);
    for (const r of rivals) {
      const path = comparePath([v.slug, r.slug]);
      if (!seen.has(path)) {
        const [a, b] = [v, r].sort((x, y) => x.slug.localeCompare(y.slug));
        seen.set(path, { path, title: `${vehicleTitle(a)} vs ${vehicleTitle(b)}`, body: v.body ? BODY_LABEL[v.body] : "Other" });
      }
    }
  }
  return [...seen.values()];
});
