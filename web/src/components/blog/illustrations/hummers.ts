/**
 * The Hummer race: four buses — petrol or diesel, manual or automatic — on the
 * job the reader picks. Each job is a run of legs, and each leg tests one
 * trade-off from the article's own table: go-slow tests the gearbox, the open
 * road tests the fuel, a doubtful filling station tests what the engine will
 * forgive, the mechanic tests what it costs to put right.
 *
 * The ratings are editorial — that table, turned into numbers — not
 * measurements, and the race says so. Each setup wins exactly one job, which is
 * the point the article makes: choose by how the bus will be used.
 */

export type Trait = "traffic" | "distance" | "fuel" | "repairs";
export type Fuel = "petrol" | "diesel";
export type Gearbox = "manual" | "automatic";
export type LegKind = "stops" | "goslow" | "expressway" | "pump" | "mechanic";

export interface Setup {
  id: string;
  fuel: Fuel;
  gearbox: Gearbox;
  label: string;
  color: string;
  ratings: Record<Trait, number>;
  /** What the bus says as it enters a leg that tests each trait. */
  says: Record<Trait, string>;
}

export const SETUPS: Setup[] = [
  {
    id: "petrol-manual",
    fuel: "petrol",
    gearbox: "manual",
    label: "Petrol · manual",
    color: "#f1efe9",
    ratings: { traffic: 2, distance: 2, fuel: 5, repairs: 5 },
    says: {
      traffic: "Clutch, brake, clutch…",
      distance: "Thirstier on long runs",
      fuel: "Forgives poor fuel",
      repairs: "Cheapest to fix",
    },
  },
  {
    id: "petrol-automatic",
    fuel: "petrol",
    gearbox: "automatic",
    label: "Petrol · automatic",
    color: "#24262a",
    ratings: { traffic: 5, distance: 2, fuel: 5, repairs: 4 },
    says: {
      traffic: "Easy in Drive",
      distance: "Thirstier on long runs",
      fuel: "Forgives poor fuel",
      repairs: "Mechanics everywhere",
    },
  },
  {
    id: "diesel-manual",
    fuel: "diesel",
    gearbox: "manual",
    label: "Diesel · manual",
    color: "#a9aeb5",
    ratings: { traffic: 2, distance: 5, fuel: 2, repairs: 3 },
    says: {
      traffic: "Clutch, brake, clutch…",
      distance: "Goes further per litre",
      fuel: "Poor fuel bites",
      repairs: "Dearer to fix",
    },
  },
  {
    id: "diesel-automatic",
    fuel: "diesel",
    gearbox: "automatic",
    label: "Diesel · automatic",
    color: "#8e2b26",
    ratings: { traffic: 5, distance: 5, fuel: 2, repairs: 2 },
    says: {
      traffic: "Easy in Drive",
      distance: "Goes further per litre",
      fuel: "Poor fuel bites",
      repairs: "Costliest to put right",
    },
  },
];

export const LEGS: Record<LegKind, { label: string; trait: Trait }> = {
  stops: { label: "Bus stops", trait: "traffic" },
  goslow: { label: "Go-slow", trait: "traffic" },
  expressway: { label: "Expressway", trait: "distance" },
  pump: { label: "Doubtful fuel", trait: "fuel" },
  mechanic: { label: "Mechanic", trait: "repairs" },
};

/** Why a setup wins where each trait is tested — the article's reasoning, in a line. */
export const WHY: Record<Trait, Record<"good" | "bad", string>> = {
  traffic: {
    good: "an automatic keeps the driver fresh in go-slow",
    bad: "a manual wears the driver down in go-slow",
  },
  distance: {
    good: "diesel goes further on a litre over long runs",
    bad: "petrol costs more over long runs",
  },
  fuel: {
    good: "petrol is more forgiving of poor fuel",
    bad: "diesel is less forgiving of poor fuel",
  },
  repairs: {
    good: "mechanics and parts are easy to find",
    bad: "it costs more to put right",
  },
};

export interface Job {
  id: string;
  label: string;
  /** For the button. */
  short: string;
  from: string;
  to: string;
  /** Lengths are shares of the run and add up to 1. */
  legs: { kind: LegKind; len: number }[];
}

export const JOBS: Job[] = [
  {
    id: "staff",
    label: "Staff bus in Lagos traffic",
    short: "Lagos staff bus",
    from: "Ikorodu",
    to: "Victoria Island",
    legs: [
      { kind: "stops", len: 0.24 },
      { kind: "goslow", len: 0.34 },
      { kind: "mechanic", len: 0.16 },
      { kind: "goslow", len: 0.26 },
    ],
  },
  {
    id: "ibadan",
    label: "Lagos to Ibadan, hired drivers",
    short: "Lagos–Ibadan daily",
    from: "Lagos",
    to: "Ibadan",
    legs: [
      { kind: "expressway", len: 0.38 },
      { kind: "mechanic", len: 0.24 },
      { kind: "expressway", len: 0.38 },
    ],
  },
  {
    id: "executive",
    label: "Executive shuttle, in and out of town",
    short: "Executive shuttle",
    from: "Ikeja",
    to: "Abeokuta",
    legs: [
      { kind: "goslow", len: 0.3 },
      { kind: "expressway", len: 0.45 },
      { kind: "goslow", len: 0.25 },
    ],
  },
  {
    id: "upcountry",
    label: "Up-country, where fuel is a gamble",
    short: "Up-country runs",
    from: "Lagos",
    to: "Up-country",
    legs: [
      { kind: "expressway", len: 0.2 },
      { kind: "pump", len: 0.3 },
      { kind: "mechanic", len: 0.3 },
      { kind: "pump", len: 0.2 },
    ],
  },
];

/** Pace on a leg, from its rating: 1 crawls, 5 flies. */
export const pace = (rating: number) => 0.55 + 0.13 * rating;

/** How long each leg takes a setup, in units of the whole run at pace 1. */
export function legTimes(setup: Setup, job: Job): number[] {
  return job.legs.map((l) => l.len / pace(setup.ratings[LEGS[l.kind].trait]));
}

export const totalTime = (setup: Setup, job: Job) => legTimes(setup, job).reduce((a, b) => a + b, 0);

/** Live stock for each setup, keyed by setup id: the matching buses, cheapest first. */
export type HummerStock = Record<
  string,
  {
    slug: string;
    title: string;
    priceMinor: number;
    coverUrl: string | null;
    seats: number | null;
  }[]
>;
