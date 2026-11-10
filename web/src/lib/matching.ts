/**
 * When a vehicle answers a Sourcing Desk request. One rule, used both ways:
 * a new request checked against stock, and a newly listed vehicle checked
 * against open requests, so the two can never disagree about a match. The
 * SQL twin is stockMatching in lib/repositories/vehicles.ts.
 * scripts/verify-matching.ts proves the rule at every build;
 * scripts/verify-matching-sql.mts proves the SQL twin picks the same cars,
 * against a database (CI's throwaway one, or the local one).
 *
 * Strict on purpose. Every word the buyer used must start a word of the
 * car's make or model ("benz" finds Mercedes-Benz, "merc" finds Mercedes),
 * within their year and budget: someone who asked for a Highlander is not
 * offered a Camry. A two-letter word is a model name (ES, GX, RX, LE) and must
 * be a whole word: "ES 350" never finds an Escalade. Short numbers and single
 * letters pin the version ("2" in "Hummer 2", "350" in "GLE 350", "C" in
 * "C-Class") and must stand on their own in the car's name, so a Hummer 1 is
 * never called a match for a Hummer 2 (audit, 9 November 2026). A body word
 * ("saloon", "SUV", "bus", "truck") is checked against the listing's body; a
 * fuel or gearbox word against its fuel and gearbox. A car with every word but
 * another version, fuel or gearbox is "close": offered as an alternative,
 * never announced as the car they asked for.
 */

/** Words that describe a want but never appear in a make or model, and that the listing does not record either. */
const NOISE = new Set([
  "a", "an", "the", "or", "and", "any", "newer", "older", "model", "models", "car", "cars", "vehicle", "vehicles", "for", "with",
  "used", "new", "brand", "foreign", "nigerian", "tokunbo", "clean", "neat", "from", "under", "below", "above", "over", "to",
  "of", "in", "on", "i", "me", "want", "need", "looking", "about", "around", "budget", "price", "naira", "year", "years",
  "class", "edition", "version", "type", "between", "full", "option", "options", "fully", "loaded", "low", "mileage", "first",
  "body", "registered", "condition", "good", "very", "accident", "free", "wagon", "wagen", "gear", "generation",
  "colour", "color", "black", "white", "silver", "grey", "gray", "red", "blue", "gold", "green", "brown",
]);

/** Saloon cars, as the inventory's "Saloon cars" chip counts them (lib/inventory-filters.ts CAR_BODIES). */
const SALOON = ["sedan", "coupe", "hatchback", "wagon", "convertible"];

/** Body words, checked against the listing's own body type. A car of another body never answers the want. */
const BODY_WORDS: Record<string, string[]> = {
  saloon: SALOON, saloons: SALOON, sedan: SALOON, sedans: SALOON,
  suv: ["suv"], suvs: ["suv"], jeep: ["suv"], jeeps: ["suv"],
  bus: ["bus"], buses: ["bus"],
  truck: ["truck"], trucks: ["truck"], lorry: ["truck"],
  van: ["van"], vans: ["van"],
  pickup: ["pickup"], pickups: ["pickup"],
};
/** Fuel and gearbox words, checked against the listing. Another fuel or gearbox makes a car close, not exact. */
const FUEL_WORDS: Record<string, string> = { diesel: "diesel", petrol: "petrol", hybrid: "hybrid", electric: "electric" };
const GEARBOX_WORDS: Record<string, string> = { manual: "manual", automatic: "automatic", auto: "automatic" };

/**
 * A make or model as the matcher reads it, the same in TypeScript and SQL: lower case, chassis codes in
 * brackets dropped ("(C292)", "(X253 generation)"), common spellings mended ("Humer", "Mercedez",
 * "Landcruiser"), and letters and digits pulled apart, so "C300" reads "c 300", "RX 350L" reads "rx 350 l"
 * and "4Runner" reads "4 runner".
 */
export function normaliseName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/humm?er/g, "hummer")
    .replace(/mercedez/g, "mercedes")
    .replace(/landcruiser/g, "land cruiser")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2");
}

/** The words of a make or model, after normaliseName. */
export function nameWords(text: string): string[] {
  return normaliseName(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** A single letter or a 1-3 digit number pins the version: it must stand alone in the car's name. */
export const isPinned = (w: string) => /^[a-z]$/.test(w) || /^\d{1,3}$/.test(w);

/** A word the buyer named may start a longer word of the car's name ("merc", "benz") from three letters up; shorter, it must be the whole word. */
export const mayBePrefix = (w: string) => w.length >= 3;

/** Whether one of the car's name words answers a word the buyer named. */
export const hasWord = (name: string[], w: string) => name.some((n) => n === w || (mayBePrefix(w) && n.startsWith(w)));

/** Amounts, years, engine sizes, seat counts and drive types: none is in a car's name, so they go before anything is read. */
function clean(want: string): string {
  return (
    want
      .toLowerCase()
      // A bracket that names the car or its fuel ("(Hummer 2)", "(diesel)") is read with the rest. One of chassis codes or
      // filler ("(C292)", "(X253 generation)", "(any colour)") stays, for normaliseName to drop as it does from a listing.
      .replace(/\(([^)]*)\)/g, (code, inner: string) => (nameWords(inner).every((w) => isPinned(w) || NOISE.has(w)) ? code : ` ${inner} `))
      // engine sizes: 2.4, 3.5L, 2.5D, 1.8T
      .replace(/\b\d{1,2}\.\d(?:\s*(?:l|litres?|liters?)|[a-z])?(?![a-z0-9])/g, " ")
      // a budget after a budget word: under 20m, below 20 m, max ₦30,000,000, up to 25 million
      .replace(/\b(?:under|below|above|over|around|about|budget|max|maximum|less than|up to)\s+(?:₦\s?|n\s?)?\d[\d,.]*\s?(?:m|k|bn|b|mil|mill?s?|milli|millions?)?(?![a-z0-9])/g, " ")
      // amount ranges: 20-25m, 20 to 25 million, N20m-N25m
      .replace(/(?<![a-z0-9.])(?:₦\s?|n\s?)?\d+(?:\.\d+)?\s?(?:m|k|bn|b)?\s?(?:-|to)\s?(?:₦\s?|n\s?)?\d+(?:\.\d+)?\s?(?:m|k|bn|b|mill?s?|milli|millions?)(?![a-z0-9])/g, " ")
      // amounts with commas: ₦500,000 · 20,000,000 · 500,000 naira (a lone "350,450" is two models, kept)
      .replace(/(?:₦\s?|\bn\s?)\d{1,3}(?:,\d{3})+(?!\d)|\b\d{1,3}(?:,\d{3}){2,}(?!\d)|\b\d{1,3}(?:,\d{3})+\s?naira\b/g, " ")
      // amounts: 20m · ₦5.5m · N 500k (with a left edge, so "X5M" keeps its 5)
      .replace(/(?<![a-z0-9.])(?:₦\s?|n\s?)?\d+(?:\.\d+)?(?:m|k|bn|b)(?![a-z0-9])/g, " ")
      // amounts in words: 25 million, 20mill, 25 millions, 500 naira
      .replace(/\b\d+(?:\.\d+)?\s?(?:millions?|mill?s?|milli|naira)\b/g, " ")
      // model years written as a model: 12 model, 2012 model
      .replace(/\b\d{2}(?:\d{2})?\s?model\b/g, " ")
      // seat counts: 18 seater, 14-seater, 7 seats
      .replace(/\b\d+\s?-?\s?(?:seaters?|seats?)\b/g, " ")
      // drive: in the listing's own fields
      .replace(/\b(?:4x4|4wd|awd|2wd|fwd|rwd|4matic|xdrive|quattro)\b/g, " ")
      // the G-Wagon is the Mercedes G-Class, listed as "G 63" and the like
      .replace(/\bg\s?-?\s?wag[oe]n?s?\b/g, " g ")
      .replace(/\bpick\s?-?\s?ups?\b/g, " pickup ")
  );
}

/** What a want asks for: the words of the name, and any body, fuel or gearbox it names. */
export interface Want {
  named: string[];
  pinned: string[];
  bodies: string[] | null;
  fuels: string[] | null;
  gearboxes: string[] | null;
}

export function readWant(want: string): Want {
  const cleaned = clean(want);
  // A letter written onto its number ("A200", "A4", "i8") is the model, even "a" or "i". A spaced one ("a 4Runner") is not.
  const joined = new Set(Array.from(cleaned.matchAll(/\b([a-z])-?(?=\d)/g), (m) => m[1]));
  const tokens = nameWords(cleaned);
  const words: string[] = [];
  const bodies = new Set<string>();
  const fuels = new Set<string>();
  const gearboxes = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    // "C-Class", "A class": the letter is the model, even "a".
    if (/^[a-z]$/.test(w) && tokens[i + 1] === "class") {
      words.push(w);
      i++;
      continue;
    }
    if (/^[a-z]$/.test(w) && joined.has(w)) {
      words.push(w);
      continue;
    }
    if (BODY_WORDS[w]) BODY_WORDS[w].forEach((b) => bodies.add(b));
    else if (FUEL_WORDS[w]) fuels.add(FUEL_WORDS[w]);
    else if (GEARBOX_WORDS[w]) gearboxes.add(GEARBOX_WORDS[w]);
    else if (!NOISE.has(w) && !/^\d{4,}$/.test(w) && !/^0\d$/.test(w)) words.push(w);
  }
  return {
    named: words.filter((w) => !isPinned(w)),
    pinned: words.filter(isPinned),
    bodies: bodies.size ? [...bodies] : null,
    fuels: fuels.size ? [...fuels] : null,
    gearboxes: gearboxes.size ? [...gearboxes] : null,
  };
}

/** The name words of a want, for display and tests: what must be in the car's name. */
export function wantWords(want: string): string[] {
  const w = readWant(want);
  return [...w.named, ...w.pinned];
}

/** Whether a want names anything a car could answer: a model word, a class letter, or a body type. A bare number does not. */
export const wantsSomething = (w: Want) => w.named.length > 0 || w.pinned.some((p) => /[a-z]/.test(p)) || w.bodies !== null;

export interface MatchableVehicle {
  make: string;
  model: string;
  year: number;
  priceMinor: number | null;
  body?: string | null;
  fuel?: string | null;
  transmission?: string | null;
}

export interface MatchableRequest {
  want: string;
  yearFrom: number | null;
  budgetMaxMinor: number | null;
}

export type MatchLevel = "exact" | "close";

/** A listing that does not record its body, fuel or gearbox is not ruled out by it... */
const fits = (value: string | null | undefined, wanted: string[] | null) => !wanted || !value || wanted.includes(value);
/** ...but cannot be shown to be what was asked for, as a car with no price is not within a budget: it is close at most. */
const shown = (value: string | null | undefined, wanted: string[] | null) => !wanted || (!!value && wanted.includes(value));

/**
 * How well a vehicle answers a request: "exact" when every word the buyer used is in the car's name, every
 * pinned word stands alone in it, and any fuel or gearbox they named is the car's; "close" when the words
 * are there but a pinned word, the fuel or the gearbox is not (a Hummer 1 for a Hummer 2, a petrol Hummer
 * for a diesel one) and the buyer named the model, not only the make; null otherwise. A body type they named
 * rules out every other body. The year and budget limits apply to both levels.
 */
export function matchLevel(v: MatchableVehicle, r: MatchableRequest): MatchLevel | null {
  const want = readWant(r.want);
  if (!wantsSomething(want)) return null;
  if (!fits(v.body, want.bodies)) return null;
  const name = nameWords(`${v.make} ${v.model}`);
  if (!want.named.every((w) => hasWord(name, w))) return null;
  if (r.yearFrom && v.year < r.yearFrom) return null;
  // A vehicle with no price cannot be shown to be within a stated budget.
  if (r.budgetMaxMinor && (v.priceMinor === null || v.priceMinor > r.budgetMaxMinor)) return null;
  if (want.pinned.every((w) => name.includes(w)) && shown(v.body, want.bodies) && shown(v.fuel, want.fuels) && shown(v.transmission, want.gearboxes)) return "exact";
  const model = nameWords(v.model);
  return want.named.some((w) => hasWord(model, w)) ? "close" : null;
}

/** The match the Sourcing Desk acts on: exact only. A buyer is never told a different version has arrived. */
export function satisfies(v: MatchableVehicle, r: MatchableRequest): boolean {
  return matchLevel(v, r) === "exact";
}
