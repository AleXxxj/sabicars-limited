import { DRIVE_PLAN } from "@/lib/drive-plan";

/**
 * The home hero's slides, and which car may stand on each.
 *
 * Pure, with no database and no React: the home page, the admin form and the
 * action that saves the owner's picks all read the same rules from here.
 *
 * The owner chooses a car for a slide in Admin, Audience ("i change the 2019
 * Hiace Hummer 2 to 2014 toyota hiace hummer (that sold one)", 14 November
 * 2026). A slide with no pick takes a car by itself, as before: the cars
 * ticked "Use in the homepage hero", in turn.
 */

export const HERO_SLIDE_KEYS = ["opening", "plan", "hummer", "check", "sell", "find", "earn"] as const;
export type HeroSlideKey = (typeof HERO_SLIDE_KEYS)[number];

/** Each slide by the name the admin shows, with the words a visitor reads on it. */
export const HERO_SLIDE_NAMES: Record<HeroSlideKey, { name: string; says: string }> = {
  opening: { name: "Opening slide", says: "Your next car is here." },
  plan: { name: "40% Drive Plan", says: "Pay 40% now. Drive it home." },
  hummer: { name: "Hummer buses", says: "The home of the Hummer bus." },
  check: { name: "Free VIN check", says: "Check any car. It is free." },
  sell: { name: "Sell or swap", says: "Sell us your car. Or swap it." },
  find: { name: "Request a car", says: "Can’t find it? Tell us." },
  earn: { name: "Earn", says: "Know a buyer? Earn 1.5%." },
};

/** The owner's picks as they are stored: a car's slug for each slide that has one. */
export type HeroPickSlugs = Partial<Record<HeroSlideKey, string>>;

/** Reads the stored value, whatever shape it has come to: only known slides, only non-empty slugs. */
export function readHeroPicks(value: unknown): HeroPickSlugs {
  if (!value || typeof value !== "object") return {};
  const out: HeroPickSlugs = {};
  for (const key of HERO_SLIDE_KEYS) {
    const slug = (value as Record<string, unknown>)[key];
    if (typeof slug === "string" && slug.trim()) out[key] = slug.trim();
  }
  return out;
}

/** What the rules need to know about a car. */
export interface HeroCandidate {
  status: string;
  model: string;
  year: number;
  priceMinor: number | null;
  hasCover: boolean;
}

/**
 * Why this car cannot stand on this slide, in words for the admin; null when
 * it can.
 *
 * A sold car may be shown: it is proof of what Sabicars sells, and the hero
 * labels it "Sold" where a price would be. But never on the two slides whose
 * words are about buying the car in the photo: the opening one ("Your next
 * car is here") and the Drive Plan one ("Pay 40% now"), which also needs a
 * priced car new enough for 40%. And the Hummer slide shows a Hummer.
 */
export function heroPickProblem(key: HeroSlideKey, car: HeroCandidate): string | null {
  if (!car.hasCover) return "has no cover photo";
  if (car.status !== "available" && car.status !== "reserved" && car.status !== "sold") return "is not on the site";
  const sold = car.status === "sold";
  if (key === "opening" && sold) return "is sold, and the opening slide says “Your next car is here”";
  if (key === "hummer" && !/hum+er/i.test(car.model)) return "is not a Hummer bus, and the slide says “The home of the Hummer bus”";
  if (key === "plan") {
    if (sold) return "is sold, and the Drive Plan slide says “Pay 40% now”";
    if (car.priceMinor === null) return "has no price, and the Drive Plan slide says “Pay 40% now”";
    if (car.year < DRIVE_PLAN.standardYear) return `is older than ${DRIVE_PLAN.standardYear}, so it needs 50% down, not the 40% the slide says`;
  }
  return null;
}
