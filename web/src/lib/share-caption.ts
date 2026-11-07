import { drivePlanTerms } from "@/lib/drive-plan";

/**
 * The words a partner sends with a car, in plain everyday English: what it is,
 * the price, the Drive Plan only where this car qualifies (and only with "if
 * they approve you"), and the partner's own link to it, last, so WhatsApp
 * draws the car's photo under the message. The buyer taps the photo and lands
 * on the car's page, with the partner's code kept.
 *
 * Plain functions, no server imports: the share page builds the words on the
 * server and the tests read them the same way.
 */
export function shareCaption(car: { title: string; year: number; price: string | null }, link: string): string {
  return [
    car.title,
    car.price ? `${car.price} at Sabicars, Lagos.` : "At Sabicars, Lagos. Ask for the price.",
    car.price ? drivePlanLine(car.year) : null,
    "See all the photos, then come and see it before you pay:",
    link,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The Drive Plan in one line, for a car whose year allows it (40% from 2010, 50% for 2008–2009), always with Autochek's condition; null otherwise. */
export function drivePlanLine(year: number): string | null {
  const terms = drivePlanTerms(year);
  return terms.eligible ? `Pay ${terms.depositPercent}% now. Autochek lends you the rest if they approve you, and you pay monthly.` : null;
}

/**
 * The caption under a status picture. Short, because the app lays it over the
 * bottom of the picture, and the picture already says the car, the price and
 * the code: what it adds is the link.
 */
export function statusWords(link: string): string {
  return `See all the photos here: ${link}`;
}

/** A partner's link to one car: the short form the /r/[code]/[slug] route answers. */
export function carShareLink(base: string, code: string, slug: string): string {
  return `${base}/r/${code}/${slug}`;
}
