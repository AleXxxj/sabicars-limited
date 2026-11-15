import { NotFoundScreen, PAGE_GONE } from "@/components/site/NotFoundScreen";

/**
 * A notFound() thrown under the public site. None is now: a page that finds nothing behind its address (a car, an
 * article, a report) draws the gone screen itself, so its words are in the HTML (components/site/NotFoundScreen.tsx).
 * Kept so that one thrown in future still keeps the visitor in the showroom.
 */
export default function SiteNotFound() {
  return <NotFoundScreen {...PAGE_GONE} />;
}
