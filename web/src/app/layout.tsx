import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { archivo } from "@/lib/fonts";
import { PARTNER_DEVICE_SCRIPT } from "@/lib/partner-device";
import { site, siteUrl } from "@/lib/site";
import "./globals.css";

/**
 * `metadataBase` makes every canonical and Open Graph URL absolute. A relative
 * canonical is ambiguous to a search engine, and a relative OG image does not
 * render at all in a WhatsApp link preview — which is where most Sabicars
 * vehicles will be shared.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Sabicars — Hummer Buses, Luxury Cars, SUVs & Trucks in Lagos",
    template: "%s · Sabicars",
  },
  description:
    `${site.legalName} (RC ${site.rcNumber}) sells Toyota Hiace Hummer buses, luxury cars, SUVs and trucks from Lagos — with fleet supply and the 40% Drive Plan financed by Autochek.`,
  applicationName: site.legalName,
  openGraph: { siteName: site.legalName, type: "website", locale: "en_NG" },
};

export const viewport: Viewport = {
  themeColor: "#090E0A",
  colorScheme: "dark",
  // Safari on iOS 26 floats its toolbar over the page as glass. With this set, the page reaches the screen's
  // edge and env(safe-area-inset-bottom) reports the toolbar's height, so the tab bar can pad for it and
  // fill the glass with Night rather than with whatever the page has scrolled under it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // One art-directed look, not a light/dark switch. A marque's showroom does
    // not change colour with the visitor's phone settings; the light variant
    // read as a plain document and made car-park photography look cheap
    // (design pass, 2026-09-26). The light tokens remain for the /style page.
    // suppressHydrationWarning: a car page's inline script marks this element (data-car-row) before React
    // hydrates, the way theme scripts do, so the phone bar is right from the first paint; React must not
    // report that mark as a mismatch. It reaches this element only, not its children. The script below
    // does the same with data-partner, so the header shows Account or Log in from the first paint.
    <html lang="en-NG" data-theme="dark" className={archivo.variable} suppressHydrationWarning>
      <body>
        <Script id="partner-device" strategy="beforeInteractive">
          {PARTNER_DEVICE_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
