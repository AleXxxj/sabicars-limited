import { Archivo, Cormorant_Garamond } from "next/font/google";

/**
 * Two voices, each with one job.
 *
 * next/font self-hosts both at build time: no runtime request to Google, no
 * layout shift, nothing for a content-security policy to block.
 */

/**
 * Display — headlines only. The "Sabicars" wordmark in the logo is set in
 * Cormorant, so the site and the mark speak with one voice. Hairline serifs
 * are beautiful large and fragile small, so this never goes below ~28px.
 */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

/**
 * Everything else. Chosen over Inter — the default of every generated site —
 * for its width axis: labels set wide and uppercase are how automotive marques
 * sign their names, and that one detail carries much of the "institution".
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
