/**
 * Facts about the business, in one place.
 *
 * Everything here is published on every page, so every line has to be true.
 * Where the legacy site contradicted itself, the choice and the reason are
 * noted — see docs/ARCHITECTURE.md §8 for what still needs the owner's word.
 */
import type { Metadata } from "next";

const MAP_QUERY = "Sabicars+Autos+Amazing+Grace+Shopping+Complex+Alhaji+Ede+Bus+Stop+Km+16+Igando+Lagos+100267";

export const site = {
  name: "Sabicars",
  legalName: "Sabicars Limited",
  rcNumber: "1560100",
  tagline: "Luxury Auto · Lagos",

  /**
   * As the legacy contact page gives it (its "verified location" block, with
   * the postcode). The newsletter template said Km 13 and the About page
   * "Amazing Grace Plaza"; Km 16 and "Shopping Complex" are used pending the
   * owner's confirmation.
   */
  address: {
    line1: "Amazing Grace Shopping Complex, Km 16",
    line2: "Alhaji Ede Bus Stop, Lasu Road, Igando",
    city: "Lagos",
    postcode: "100267",
    country: "NG",
  },

  /** The Google Maps listing the legacy contact page links to ("Sabicars Autos"). */
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`,
  /** The same listing as an embeddable map — satellite view, as on the legacy contact page. */
  mapEmbedUrl: `https://maps.google.com/maps?q=${MAP_QUERY}&t=k&z=16&ie=UTF8&iwloc=&output=embed`,

  /** Published on the legacy contact page. */
  hours: [
    { days: "Monday – Friday", time: "8:00am – 7:00pm", schema: "Mo-Fr 08:00-19:00" },
    { days: "Saturday – Sunday", time: "9:00am – 6:00pm", schema: "Sa-Su 09:00-18:00" },
  ],

  /** Anyone can check the registration themselves — an institution invites it. */
  cacSearchUrl: "https://search.cac.gov.ng",

  phones: [
    { display: "0810 188 5558", e164: "+2348101885558" },
    { display: "0912 159 6011", e164: "+2349121596011" },
  ],

  /** One deliberate WhatsApp entry point for the whole platform. */
  whatsapp: { e164: "+2348055065825", display: "0805 506 5825" },

  /**
   * sabicars.com has mail servers (Google Workspace). sabicars.ng has no MX
   * record at all, so the info@sabicars.ng address printed across the legacy
   * site cannot receive mail.
   */
  email: "info@sabicars.com",

  social: {
    instagram: "https://instagram.com/sabicarsltd",
  },
} as const;

/**
 * The site's own address: canonical links, link previews, the sitemap, emails.
 *
 * NEXT_PUBLIC_SITE_URL wins when it is set. Otherwise, on Vercel, it is the
 * project's production address, which Vercel supplies: sabicars.vercel.app
 * until sabicars.com is added as the project's domain, sabicars.com after. A
 * page must name an address that serves it — WhatsApp follows the canonical
 * link to build a preview, and before the switch sabicars.com/vehicles/… is a
 * 404 on the old site, so the preview came out empty. Elsewhere, sabicars.com.
 */
export function siteUrl(): string {
  const production = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? (production ? `https://${production}` : "https://sabicars.com")).replace(/\/+$/, "");
}

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** The preview image for a page that has no photo of its own (app/opengraph-image.png). */
const SHARE_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, type: "image/png", alt: site.legalName };

/**
 * A page's address for search engines and for link previews, which must agree.
 *
 * WhatsApp draws a preview only when og:title, og:description and og:url are
 * all in the head, and Next does not derive og:url from the canonical. A
 * page's `openGraph` also replaces the layout's whole instead of merging with
 * it, so the shared fields and the default image are restated here. Without
 * this, an answer page went out with no image at all and an article without
 * the site's name.
 */
export function pageAddress(path: string, openGraph: OpenGraph = {}): Pick<Metadata, "alternates" | "openGraph"> {
  return {
    alternates: { canonical: path },
    openGraph: {
      siteName: site.legalName,
      locale: "en_NG",
      type: "website",
      ...openGraph,
      images: openGraph.images ?? SHARE_IMAGE,
      url: path,
    },
  };
}

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${site.whatsapp.e164.replace("+", "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
