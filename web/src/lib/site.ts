/**
 * Facts about the business, in one place.
 *
 * Everything here is published on every page, so every line has to be true.
 * Where the legacy site contradicted itself, the choice and the reason are
 * noted — see docs/ARCHITECTURE.md §8 for what still needs the owner's word.
 */
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
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Sabicars+Autos+Amazing+Grace+Shopping+Complex+Alhaji+Ede+Bus+Stop+Km+16+Igando+Lagos+100267",

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

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sabicars.com").replace(/\/+$/, "");
}

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${site.whatsapp.e164.replace("+", "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
