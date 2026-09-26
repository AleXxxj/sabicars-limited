/**
 * When a vehicle answers a Sourcing Desk request. One rule, used both ways:
 * a new request checked against stock, and a newly listed vehicle checked
 * against open requests — so the two can never disagree about a match.
 *
 * Strict on purpose: every meaningful word the buyer used must appear in the
 * make or model ("benz" finds Mercedes-Benz), within their year and budget.
 * Someone who asked for a Highlander should not be offered a Camry.
 */

/** Words that describe a want but never appear in a make or model. */
const NOISE = new Set(["a", "an", "the", "or", "and", "any", "newer", "older", "model", "car", "cars", "for", "with", "used", "new", "brand", "foreign", "nigerian", "tokunbo", "clean", "neat"]);

export function wantWords(want: string): string[] {
  return want
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((w) => w.length >= 2 && !NOISE.has(w) && !/^\d+$/.test(w));
}

export interface MatchableVehicle {
  make: string;
  model: string;
  year: number;
  priceMinor: number | null;
}

export interface MatchableRequest {
  want: string;
  yearFrom: number | null;
  budgetMaxMinor: number | null;
}

export function satisfies(v: MatchableVehicle, r: MatchableRequest): boolean {
  const words = wantWords(r.want);
  if (!words.length) return false;
  const name = `${v.make} ${v.model}`.toLowerCase();
  if (!words.every((w) => name.includes(w))) return false;
  if (r.yearFrom && v.year < r.yearFrom) return false;
  // A vehicle with no price cannot be shown to be within a stated budget.
  if (r.budgetMaxMinor && (v.priceMinor === null || v.priceMinor > r.budgetMaxMinor)) return false;
  return true;
}
