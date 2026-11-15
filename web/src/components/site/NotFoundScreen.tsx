import { ButtonLink } from "@/components/ui/Button";

/** Any address with nothing behind it: old, mistyped, or a page taken down. */
export const PAGE_GONE = {
  kicker: "Page not found",
  title: "That page is not here.",
  body: "The address may be old or mistyped. Everything we sell is on the cars page, and if you are looking for a car that was here, tell us and we will find one like it.",
};

/** A car link, or a reserve link, for a car that is no longer listed. Most arrive from WhatsApp. */
export const CAR_GONE = {
  kicker: "This car has gone",
  title: "This car is no longer listed.",
  body: "It may have been sold or taken down. Everything still for sale is on the cars page, and if you want one like it, tell us and we will look for it.",
};

/**
 * For a page whose address has nothing behind it: kept out of search results, as a 404 would be, while its links
 * (the cars, Request a car) are still followed.
 */
export const GONE_ROBOTS = { index: false, follow: true } as const;

/**
 * What a visitor sees at an address that has nothing behind it: an old car
 * link, a mistyped address, a page that was taken down. Plain words, and two
 * ways on, inside the page itself (audit, 9 November 2026: the bare "404"
 * left a buyer to find the header on their own).
 *
 * A page with a name in its address (a car, an article, a report) renders this
 * itself, with GONE_ROBOTS in its metadata, rather than calling notFound().
 * Next answers a notFound() with status 404 and an empty page, its "error
 * shell", which the phone must fill in with the site's code: a blank white
 * screen on slow data until that code arrives, and for good if it never does
 * (14 and 15 November 2026). Drawn by the page, the words are in the HTML the
 * server sends, so they show at once. The cost is the status: 200 with
 * noindex, which search engines treat as a page to drop, as they do a 404. A
 * wrong address altogether still answers 404 with this screen
 * (app/not-found.tsx). data-gone lets the checks that need to know (the link
 * check, the launch checks, the flows suite's guard) tell such a page from a
 * real one: lib/gone-page.ts.
 */
export function NotFoundScreen({ kicker, title, body }: { kicker: string; title: string; body: string } = PAGE_GONE) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28" data-gone="">
      <p className="kicker">{kicker}</p>
      <h1 className="mt-5 text-display-2">{title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-text-secondary">{body}</p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/vehicles">See cars for sale</ButtonLink>
        <ButtonLink href="/find" variant="secondary">
          Request a car
        </ButtonLink>
      </div>
    </div>
  );
}
