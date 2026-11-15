/**
 * What a buyer types into a search box, read the way they mean it: the homepage's "Find your car"
 * (components/home/HomeSearch.tsx) and the search box on Cars for sale (the inventory query in
 * lib/repositories/vehicles.ts). Plain functions, for the browser and the server alike.
 */

/** The first amount in the text that reads as money, in whole naira, and where it sits. */
function moneyIn(plain: string): { naira: number; start: number; end: number } | null {
  for (const m of plain.matchAll(/(\d+(?:\.\d+)?)\s*(m\b|mil\b|million|k\b)?/g)) {
    const n = Number(m[1]);
    const unit = m[2];
    const naira = unit === "k" ? n * 1_000 : unit ? n * 1_000_000 : n;
    if (naira >= 100_000) return { naira: Math.round(naira), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length };
  }
  return null;
}

/**
 * A budget typed the way people say it — "20m", "₦20,000,000", "20 million",
 * "under 15m" — in whole naira, or null. A bare small number ("20", "2018",
 * "7-seater") is not a budget: it could be a year or a seat count, so the
 * first number that reads as money wins, wherever it sits ("2018 highlander 30m").
 */
export function budgetFrom(text: string): number | null {
  return moneyIn(text.toLowerCase().replace(/[₦,]/g, ""))?.naira ?? null;
}

type Condition = "foreign_used" | "nigerian_used" | "brand_new";

/** How buyers name a car's history: "tokunbo" is foreign used. */
const CONDITION_WORDS: [RegExp, Condition][] = [
  [/\b(tokunbo|foreign[\s-]*used|foreign)\b/, "foreign_used"],
  [/\b(nigerian?[\s-]*used|naija[\s-]*used|locally[\s-]*used|local[\s-]*used)\b/, "nigerian_used"],
  [/\bbrand[\s-]*new\b/, "brand_new"],
];

/** Words that say nothing about which car: "a clean SUV for sale in Lagos" searches for "suv". */
const FILLER = new Set(
  (
    "a an the for sale in at of on with and or to i me my want need looking buy buying car cars vehicle vehicles auto autos " +
    "under below less than max maximum around about budget price prices naira lagos nigeria sabicars sabi from up " +
    "cheap cheapest best good nice clean deposit down drive plan monthly finance used new"
  ).split(" "),
);

/** A word that stands for others: "saloon" is any car that is not an SUV, as the "Saloon cars" chip has it. */
const SYNONYMS: Record<string, string[]> = {
  saloon: ["sedan", "coupe", "hatchback", "wagon", "convertible"],
  saloons: ["sedan", "coupe", "hatchback", "wagon", "convertible"],
  jeep: ["jeep", "suv"],
  jeeps: ["jeep", "suv"],
  "pick-up": ["pickup"],
};

/** A word, and the word without a plural ending: "highlanders" → "highlander", "buses" → "bus". */
function singularsOf(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith("s")) out.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith("es")) out.push(word.slice(0, -2));
  return out;
}

export interface SearchReading {
  /** Each word to find in a car's make, model, trim, colour, type or address, with the words it may stand for. */
  words: string[][];
  /** Model years typed as numbers ("2018 camry"). */
  years: number[];
  /** A budget ("under 15m"), whole naira: the most a car may cost. */
  maxPrice: number | null;
  /** A budget said as a deposit ("10m down", "drive plan 8m"), whole naira. */
  maxDeposit: number | null;
  /** "18 seater": at least that many seats. */
  minSeats: number | null;
  condition: Condition | null;
}

/** What a search means: its budget, its years, its seats, a car's history, and the words left to look for. */
export function readSearch(q: string): SearchReading {
  let plain = ` ${q.toLowerCase().replace(/[₦,]/g, "")} `;
  let condition: Condition | null = null;
  for (const [pattern, c] of CONDITION_WORDS) {
    if (!pattern.test(plain)) continue;
    condition ??= c;
    plain = plain.replace(new RegExp(pattern.source, "g"), " ");
  }
  let maxPrice: number | null = null;
  let maxDeposit: number | null = null;
  const money = moneyIn(plain);
  if (money) {
    if (/\b(deposit|down|drive\s*plan|plan)\b/.test(plain)) maxDeposit = money.naira;
    else maxPrice = money.naira;
    plain = `${plain.slice(0, money.start)} ${plain.slice(money.end)}`;
  }
  let minSeats: number | null = null;
  const seats = plain.match(/\b(\d{1,2})\s*-?\s*seat(?:er|ers|s)?\b/);
  if (seats) {
    minSeats = Number(seats[1]);
    plain = plain.replace(seats[0], " ");
  }
  const lastYear = new Date().getFullYear() + 1;
  const years: number[] = [];
  const words: string[][] = [];
  for (const token of plain.split(/[^a-z0-9-]+/)) {
    const word = token.replace(/^-+|-+$/g, "");
    if (!word) continue;
    if (/^\d{4}$/.test(word) && Number(word) >= 1980 && Number(word) <= lastYear) {
      if (!years.includes(Number(word))) years.push(Number(word));
      continue;
    }
    if (FILLER.has(word) || (word.length < 2 && !/^\d$/.test(word))) continue;
    // "Highlanders" finds the Highlander, and "buses" the bus.
    words.push(SYNONYMS[word] ?? singularsOf(word));
    if (words.length === 6) break;
  }
  return { words, years: years.slice(0, 4), maxPrice, maxDeposit, minSeats, condition };
}
