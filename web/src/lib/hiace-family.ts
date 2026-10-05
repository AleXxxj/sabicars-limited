/**
 * The Hiace family as Sabicars sells it: the old Hiace in its two forms, and
 * the Hummer 1, 2 and 3.
 *
 * "Hummer 1, 2, 3" are not Toyota's names, and the market does not use them
 * one way. These are Sabicars' own definitions, given by the dealership: the
 * number means the engine, the size and the face together. The engine figures
 * are Toyota's published outputs for those engines. One table feeds the
 * buyer's guide, its race, and Ask Sabicars, so none of them can disagree —
 * and when a listing contradicts it, the listing is what needs checking.
 */

export type FamilyId = "square" | "short" | "hummer1" | "hummer2" | "hummer3";
export type BusShape = "square" | "short" | "hummer" | "hummer-tall";

export interface FamilyMember {
  id: FamilyId;
  name: string;
  /** What it is, in Toyota's terms. */
  what: string;
  engine: string;
  /** Toyota's published outputs, as a range where the engine changed over the years. */
  power: string;
  torque: string;
  /** Representative figures the race works with. */
  hp: number;
  nm: number;
  /** What Sabicars usually sees fitted. */
  seats: number;
  body: string;
  /** The body's size against a Hummer 2's: the race's stand-in for weight, not a weighed figure. */
  size: number;
  bestFor: string;
  shape: BusShape;
  color: string;
  /** Which listings belong to it, by model name. */
  match: RegExp;
}

export const FAMILY: FamilyMember[] = [
  {
    id: "square",
    name: "Old Hiace (square face)",
    what: "Toyota's fourth-generation Hiace, built 1989–2004, before the Hummer shape",
    engine: "2.0 or 2.4-litre petrol (1RZ / 2RZ); some have a 2.8 or 3.0 diesel",
    power: "about 100–118 hp",
    torque: "about 160–200 Nm",
    hp: 110,
    nm: 180,
    seats: 15,
    body: "Upright square front, medium roof",
    size: 0.9,
    bestFor: "The lowest price of entry, for light work and short runs",
    shape: "square",
    color: "#c9b48a",
    match: /square|1989|199\d|200[0-3]/i,
  },
  {
    id: "short",
    name: "Short Hiace",
    what: "The fifth-generation Hiace (from 2004) with the standard roof and short body",
    engine: "2.0-litre petrol (1TR)",
    power: "about 134 hp",
    torque: "182 Nm",
    hp: 134,
    nm: 182,
    seats: 9,
    body: "Standard roof, short body: the smallest and lightest",
    size: 0.86,
    bestFor: "Small teams, families and errands — quick and easy to park",
    shape: "short",
    color: "#e9e6de",
    match: /short/i,
  },
  {
    id: "hummer1",
    name: "Hummer 1",
    what: "The fifth-generation high-roof Hiace with the 2.0 engine",
    engine: "2.0-litre petrol (1TR)",
    power: "about 134 hp",
    torque: "182 Nm",
    hp: 134,
    nm: 182,
    seats: 16,
    body: "High roof",
    size: 0.97,
    bestFor: "City staff and school runs on a tighter budget",
    shape: "hummer",
    color: "#a9aeb5",
    match: /hum+er ?(1|i|one)\b/i,
  },
  {
    id: "hummer2",
    name: "Hummer 2",
    what: "The fifth-generation high-roof Hiace with the bigger 2.7 engine",
    engine: "2.7-litre petrol (2TR-FE)",
    power: "about 150–160 hp",
    torque: "about 245 Nm",
    hp: 155,
    nm: 245,
    seats: 18,
    body: "High roof",
    size: 1,
    bestFor: "Full loads every day — staff buses, churches, interstate work",
    shape: "hummer",
    color: "#24262a",
    match: /hum+er ?(2|ii|two)\b/i,
  },
  {
    id: "hummer3",
    name: "Hummer 3",
    what: "The 2.7 engine in the roomiest body: a higher roof and a longer cabin",
    engine: "2.7-litre petrol (2TR-FE)",
    power: "about 150–160 hp",
    torque: "about 245 Nm",
    hp: 155,
    nm: 245,
    seats: 18,
    body: "The highest roof and longest cabin: more headroom and legroom",
    size: 1.06,
    bestFor: "Executive shuttles and long trips, where comfort matters",
    shape: "hummer-tall",
    color: "#8e2b26",
    match: /hum+er ?(3|iii|three)\b/i,
  },
];

export const familyMember = (id: FamilyId) => FAMILY.find((m) => m.id === id)!;

/** Which family a listing belongs to, from its model name and year; null if it is not a Hiace. */
export function familyOf(v: { model: string; year: number }): FamilyId | null {
  if (!/hiace|hum+er/i.test(v.model)) return null;
  for (const id of ["hummer3", "hummer2", "hummer1", "short"] as const) if (familyMember(id).match.test(v.model)) return id;
  return v.year < 2004 ? "square" : null;
}

/**
 * The family as text, for Ask Sabicars to explain from. Plain and complete, so
 * it can answer "what's the difference between Hummer 1 and 2?" without guessing.
 */
export function familyGuide(): string {
  return [
    `"Hummer 1, 2, 3" are Nigerian market names, not Toyota's, and other sellers use them differently. At Sabicars the number means the engine, the size and the face together. Each Hummer has its own front design (lights and grille), which is how people tell them apart at a glance.`,
    ...FAMILY.map(
      (m) =>
        `- ${m.name}: ${m.what}. Engine: ${m.engine}, ${m.power}, ${m.torque} of torque. Usually ${m.seats} seats. Body: ${m.body}. Best for: ${m.bestFor}.`,
    ),
    `What the numbers mean on the road: the 2.7 in Hummer 2 and 3 has about a third more pulling power (torque) than the 2.0 in Hummer 1, so it copes better with a full load, hills and long distances. Hummer 3 has the same engine as Hummer 2 in a roomier body, so it trades a little pace for comfort. The short Hiace is the quickest when full only because full means 9 people. The square-face Hiace is the oldest — at least 20 years — and the slowest under load.`,
    `Prices also follow year, condition, layout and papers, not only the number. If a listing contradicts this guide (for example a Hummer 1 listed with the 2.7 engine), say the team will confirm the engine rather than choosing.`,
  ].join("\n");
}
