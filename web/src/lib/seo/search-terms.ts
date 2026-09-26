/**
 * The phrases buyers type into Google — "Toyota Highlander for sale in Lagos",
 * "Lexus RX 350 price in Nigeria" — mapped onto the stock. A listing is called
 * "Highlander XLE" or "RX 350 F SPORT"; a buyer searches for the family, so
 * every family with stock gets its own page (/buy/[term]).
 */

export interface Term {
  slug: string;
  label: string;
  make: string;
  /** Null for a make page ("Toyota"); the model family otherwise ("Highlander"). */
  family: string | null;
}

/** Families that are more than one word. Checked before the first-word rule. */
const MULTI_WORD = ["Land Cruiser Prado", "Land Cruiser", "Santa Fe", "Grand Cherokee", "Range Rover Sport", "Range Rover", "Hiace Hummer"];

const MERCEDES_CLASS = /\b(G-Class|GLE|GLC|GLS|GLA|GLK|GL|ML|CLA|CLS|C-Class|E-Class|S-Class)\b/i;
const LEXUS_CODE = /\b([A-Z]{2}) ?(\d{3})/i;

/** "Highlander XLE" → "Highlander"; "RX 350 F SPORT" → "RX 350"; "AMG GLE 43 Coupe 4MATIC (C292)" → "GLE". */
export function modelFamily(make: string, model: string): string {
  const m = model.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  if (make === "Mercedes-Benz") {
    const cls = m.match(MERCEDES_CLASS);
    if (cls) return /-class$/i.test(cls[1]) ? cls[1].replace(/^(.)/, (c) => c.toUpperCase()).replace(/-class$/i, "-Class") : cls[1].toUpperCase();
  }
  if (make === "Lexus") {
    const code = m.match(LEXUS_CODE);
    if (code) return `${code[1].toUpperCase()} ${code[2]}`;
  }
  const lower = m.toLowerCase();
  const multi = MULTI_WORD.find((w) => lower.includes(w.toLowerCase()));
  if (multi) return multi;
  if (/\bhiace\b/i.test(m)) return "Hiace";
  return m.split(" ")[0];
}

export function slugPart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function termFor(make: string, family: string | null): Term {
  return family
    ? { slug: `${slugPart(make)}-${slugPart(family)}`, label: `${make} ${family}`, make, family }
    : { slug: slugPart(make), label: make, make, family: null };
}

/** The page for a term. The Hiace Hummer family already has its own page; a second one would compete with it in search. */
export function termHref(slug: string): string {
  return slug === "toyota-hiace-hummer" ? "/hummer-bus" : `/buy/${slug}`;
}
