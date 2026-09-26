import { MobileTabBar } from "@/components/site/MobileTabBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

/** The public site: every page a customer can reach shares this frame. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface-0 focus:px-4 focus:py-3">
        Skip to content
      </a>
      <SiteHeader />
      {/* Room at the foot for the phone's tab bar, so it never covers the footer. */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0">
        <main id="main">{children}</main>
        <SiteFooter />
      </div>
      <MobileTabBar />
    </>
  );
}
