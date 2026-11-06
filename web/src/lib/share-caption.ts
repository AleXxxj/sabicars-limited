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
  const terms = drivePlanTerms(car.year);
  return [
    car.title,
    car.price ? `${car.price} at Sabicars, Lagos.` : "At Sabicars, Lagos. Ask for the price.",
    car.price && terms.eligible ? `Pay ${terms.depositPercent}% now. Autochek lends you the rest if they approve you, and you pay monthly.` : null,
    "See all the photos, then come and see it before you pay:",
    link,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A partner's link to one car: the short form the /r/[code]/[slug] route answers. */
export function carShareLink(base: string, code: string, slug: string): string {
  return `${base}/r/${code}/${slug}`;
}
