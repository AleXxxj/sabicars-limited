import { Archivo } from "next/font/google";

/**
 * One family, two voices (identity of 2026-10-20).
 *
 * Archivo carries everything: set heavy and slightly wide it is the display
 * voice — confident, engineered, the register of a marque rather than a
 * boutique — and at normal width it is a calm, legible text face. The logo's
 * lettering (Exo 2) lives only inside the logo, as outlines, so the site never
 * mixes two display faces.
 *
 * next/font self-hosts it at build time: no runtime request to Google, no
 * layout shift, nothing for a content-security policy to block.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
  display: "swap",
});
