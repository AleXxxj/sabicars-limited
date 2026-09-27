/**
 * Five SUVs rated for Nigerian roads, out of five. These are editorial
 * judgements — what the SUVs are known for, weighed by how Nigerians use them —
 * not measurements, and the illustrations say so. One table feeds both the race
 * and the radar, so they can never disagree.
 */

export type Axis = "rough" | "fuel" | "space" | "luxury" | "keep" | "resale";
export type Shape = "crossover" | "boxy" | "sleek";

export const AXES: { id: Axis; label: string; short: string }[] = [
  { id: "rough", label: "Bad roads and floods", short: "Rough roads" },
  { id: "fuel", label: "Fuel economy", short: "Fuel" },
  { id: "space", label: "Room for seven", short: "Space" },
  { id: "luxury", label: "Luxury and comfort", short: "Luxury" },
  { id: "keep", label: "Parts and mechanics", short: "Upkeep" },
  { id: "resale", label: "Resale value", short: "Resale" },
];

export interface Suv {
  id: string;
  name: string;
  short: string;
  shape: Shape;
  /** The /buy page for the family, when Sabicars has a page for it. */
  term: string | null;
  ratings: Record<Axis, number>;
}

export const SUVS: Suv[] = [
  {
    id: "highlander",
    name: "Toyota Highlander",
    short: "Highlander",
    shape: "crossover",
    term: "toyota-highlander",
    ratings: { rough: 3, fuel: 5, space: 5, luxury: 3, keep: 5, resale: 5 },
  },
  {
    id: "gx",
    name: "Lexus GX 460",
    short: "GX 460",
    shape: "boxy",
    term: "lexus-gx-460",
    ratings: { rough: 5, fuel: 2, space: 3, luxury: 4, keep: 4, resale: 5 },
  },
  {
    id: "prado",
    name: "Toyota Land Cruiser Prado",
    short: "Prado",
    shape: "boxy",
    term: "toyota-land-cruiser-prado",
    ratings: { rough: 5, fuel: 3, space: 4, luxury: 3, keep: 5, resale: 5 },
  },
  {
    id: "gle",
    name: "Mercedes-Benz GLE",
    short: "GLE",
    shape: "crossover",
    term: "mercedes-benz-gle",
    ratings: { rough: 3, fuel: 3, space: 3, luxury: 5, keep: 2, resale: 3 },
  },
  {
    id: "rrs",
    name: "Range Rover Sport",
    short: "Range Rover Sport",
    shape: "sleek",
    term: null,
    ratings: { rough: 4, fuel: 2, space: 2, luxury: 5, keep: 1, resale: 3 },
  },
];

export type RoadScene = "potholes" | "flood" | "highway" | "city" | "carpet";

export const ROADS: { id: string; label: string; scene: RoadScene; weights: Partial<Record<Axis, number>> }[] = [
  { id: "potholes", label: "Lagos potholes, every day", scene: "potholes", weights: { rough: 0.4, keep: 0.35, fuel: 0.25 } },
  { id: "flood", label: "Rainy-season floods", scene: "flood", weights: { rough: 0.85, keep: 0.15 } },
  { id: "abuja", label: "The long run to Abuja", scene: "highway", weights: { fuel: 0.35, luxury: 0.3, rough: 0.2, keep: 0.15 } },
  { id: "school", label: "School runs and traffic", scene: "city", weights: { space: 0.4, fuel: 0.4, keep: 0.2 } },
  { id: "style", label: "Arriving in style", scene: "carpet", weights: { luxury: 0.6, rough: 0.25, resale: 0.15 } },
];

export function scoreOn(suv: Suv, weights: Partial<Record<Axis, number>>): number {
  return Object.entries(weights).reduce((s, [axis, w]) => s + (w ?? 0) * suv.ratings[axis as Axis], 0);
}

/** Why a car did well on a road: the two axes that earned it the most. */
export function strengths(suv: Suv, weights: Partial<Record<Axis, number>>): string[] {
  return Object.entries(weights)
    .map(([axis, w]) => ({ axis: axis as Axis, points: (w ?? 0) * suv.ratings[axis as Axis] }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map(({ axis }) => `${AXES.find((a) => a.id === axis)!.label.toLowerCase()} (${suv.ratings[axis]}/5)`);
}

/** Live stock for each SUV family, keyed by SUV id. */
export type SuvStock = Record<string, { count: number; fromMinor: number | null }>;
