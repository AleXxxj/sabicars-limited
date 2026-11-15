/**
 * The mark on the gone screen (components/site/NotFoundScreen.tsx, its `data-gone` attribute).
 *
 * A public page whose address has nothing behind it answers 200 with that screen, not 404: Next answers a page's
 * notFound() with an empty page the phone must fill in. So a status alone no longer says whether an address is live,
 * and anything that checks it reads the page for this mark too: the link check (e2e/smoke/links.spec.ts), the launch
 * check of the old site's addresses (lib/launch-checks.ts) and the flows suite's database guard (e2e/helpers.ts).
 *
 * The element, not the word: every page's own data names the screen it would fall back to, so "data-gone" appears in
 * the HTML of real pages too, but only the gone screen carries it as an attribute.
 */
const GONE_ELEMENT = /<[a-z][a-z0-9]*\s[^>]*\bdata-gone=""/;

/** Whether this HTML is the gone screen, an address with nothing behind it. */
export function isGonePage(html: string): boolean {
  return GONE_ELEMENT.test(html);
}
