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
   * The legacy contact page (most recently edited) says Km 16; the newsletter
   * template says Km 13. Km 16 is used pending confirmation.
   */
  address: {
    line1: "Amazing Grace Plaza, Km 16, Alhaji-Ede Bus Stop",
    line2: "Lasu Road, off Isheri, Igando",
    city: "Lagos",
    country: "NG",
  },

  phones: [
    { display: "0810 188 5558", e164: "+2348101885558" },
    { display: "0912 159 6011", e164: "+2349121596011" },
  ],

  /** One deliberate WhatsApp entry point for the whole platform. */
  whatsapp: { e164: "+2348055065825" },

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
