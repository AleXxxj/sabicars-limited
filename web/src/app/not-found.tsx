import type { Metadata } from "next";
import { Analytics } from "@/components/site/Analytics";
import { MobileTabBar } from "@/components/site/MobileTabBar";
import { NotFoundScreen, PAGE_GONE } from "@/components/site/NotFoundScreen";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

/** Read out by screen readers as the page opens: not the home page's title. */
export const metadata: Metadata = { title: "Page not found" };

/**
 * An address that matches no page at all. It renders under the root layout
 * only, so the site's own frame is drawn here (the skip link, header, footer
 * and tab bar of the (site) layout) to keep the visitor in the showroom
 * rather than on a bare screen, and the visit is counted like any other.
 */
export default function NotFound() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface-0 focus:px-4 focus:py-3">
        Skip to content
      </a>
      <SiteHeader />
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <main id="main">
          <NotFoundScreen {...PAGE_GONE} />
        </main>
        <SiteFooter />
      </div>
      <MobileTabBar />
      <Analytics />
    </>
  );
}
