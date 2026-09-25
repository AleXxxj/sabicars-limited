import type { Metadata, Viewport } from "next";
import { archivo, cormorant } from "@/lib/fonts";
import { site, siteUrl } from "@/lib/site";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
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
  themeColor: "#0B0A09",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark is the default: the brand is black and gold, and vehicle
    // photography reads best on it. A theme toggle swaps this attribute.
    // suppressHydrationWarning: the boot script may switch data-theme before
    // React hydrates, which is intended.
    <html lang="en-NG" data-theme="dark" className={`${cormorant.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
