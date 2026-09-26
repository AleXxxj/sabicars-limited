import type { Metadata, Viewport } from "next";
import { archivo, cormorant } from "@/lib/fonts";
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
    default: "Sabicars — Verified Luxury Cars, Hiace Buses & Trucks in Lagos",
    template: "%s · Sabicars",
  },
  description:
    "Sabicars Limited (RC 1560100) sells verified luxury cars, Toyota Hiace buses, SUVs and trucks from Lagos, with nationwide delivery and the 40% Drive Plan.",
  applicationName: site.legalName,
  openGraph: { siteName: site.legalName, type: "website", locale: "en_NG" },
};

export const viewport: Viewport = {
  themeColor: "#0A0908",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // One art-directed look, not a light/dark switch. A marque's showroom does
    // not change colour with the visitor's phone settings; the light variant
    // read as a plain document and made car-park photography look cheap
    // (design pass, 2026-09-26). The light tokens remain for the /style page.
    <html lang="en-NG" data-theme="dark" className={`${cormorant.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
