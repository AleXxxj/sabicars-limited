import { NotFoundScreen, PAGE_GONE } from "@/components/site/NotFoundScreen";

/** A page under the public site that found nothing behind its address (an article, a comparison, a page taken down). */
export default function SiteNotFound() {
  return <NotFoundScreen {...PAGE_GONE} />;
}
