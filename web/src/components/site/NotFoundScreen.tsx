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
 * What a visitor sees at an address that has nothing behind it: an old car
 * link, a mistyped address, a page that was taken down. Plain words, and two
 * ways on, inside the page itself (audit, 9 November 2026: the bare "404"
 * left a buyer to find the header on their own).
 */
export function NotFoundScreen({ kicker, title, body }: { kicker: string; title: string; body: string } = PAGE_GONE) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
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
