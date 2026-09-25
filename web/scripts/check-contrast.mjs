#!/usr/bin/env node
/**
 * WCAG 2.1 contrast validator for the Sabicars palette.
 *
 * Runs as part of `npm run build`. A palette change that makes any text or
 * control illegible fails the build instead of shipping. Luxury sites drift
 * towards low-contrast "elegance" — pale gold on ivory, grey on black — and
 * the visitor squinting at a price on a phone in Lagos sunlight is the one who
 * pays for it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const palette = JSON.parse(readFileSync(join(here, "../src/styles/palette.json"), "utf8"));

/** "#RRGGBB" -> [r, g, b] in 0..255 */
function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance (sRGB). */
function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve "gold.500" against the palette. */
function tok(path) {
  const value = path.split(".").reduce((acc, k) => (acc === undefined ? undefined : acc[k]), palette);
  if (typeof value !== "string") throw new Error(`Unknown palette token: ${path}`);
  return value;
}

// 4.5 AA body text · 3.0 AA large text (>=24px, or >=19px bold) and UI boundaries
const AA_TEXT = 4.5;
const AA_UI = 3.0;

/** [foreground, background, minimum, label] */
const checks = [
  // ── Dark theme: text on every surface it can sit on ─────────────────────
  ["darkText.primary", "darkSurface.0", AA_TEXT, "body on page"],
  ["darkText.primary", "darkSurface.1", AA_TEXT, "body on card"],
  ["darkText.primary", "darkSurface.2", AA_TEXT, "body on raised"],
  ["darkText.primary", "darkSurface.3", AA_TEXT, "body on hover"],
  ["darkText.secondary", "darkSurface.0", AA_TEXT, "secondary on page"],
  ["darkText.secondary", "darkSurface.1", AA_TEXT, "secondary on card"],
  ["darkText.secondary", "darkSurface.2", AA_TEXT, "secondary on raised"],
  ["darkText.muted", "darkSurface.0", AA_TEXT, "muted on page"],
  ["darkText.muted", "darkSurface.1", AA_TEXT, "muted on card"],
  ["darkText.muted", "darkSurface.2", AA_TEXT, "muted on raised"],

  // ── Dark theme: gold as the brand and the call to action ────────────────
  ["gold.400", "darkSurface.0", AA_TEXT, "gold text/link on page"],
  ["gold.400", "darkSurface.1", AA_TEXT, "gold text/link on card"],
  ["gold.400", "darkSurface.2", AA_TEXT, "gold text/link on raised"],
  ["darkSurface.0", "gold.500", AA_TEXT, "CTA label on gold button"],
  ["darkSurface.0", "gold.400", AA_TEXT, "CTA label on gold hover"],
  ["gold.500", "darkSurface.0", AA_UI, "gold button edge vs page"],
  ["gold.500", "darkSurface.1", AA_UI, "gold button edge vs card"],

  // ── Photography: labels and type laid over a vehicle photo ──────────────
  // Always the dark treatment, in both themes (badges, hero eyebrow).
  ["gold.300", "darkSurface.0", AA_TEXT, "gold badge/eyebrow on dark photo chip"],
  ["darkText.primary", "darkSurface.0", AA_TEXT, "hero headline on scrim"],

  // ── Dark theme: semantic ────────────────────────────────────────────────
  ["semantic.successDark", "darkSurface.1", AA_TEXT, "success on card"],
  ["semantic.warningDark", "darkSurface.1", AA_TEXT, "warning on card"],
  ["semantic.dangerDark", "darkSurface.1", AA_TEXT, "danger on card"],
  ["semantic.infoDark", "darkSurface.1", AA_TEXT, "info on card"],

  // ── Dark theme: structure must be perceivable ───────────────────────────
  ["focus.dark", "darkSurface.0", AA_UI, "focus ring on page"],
  ["focus.dark", "darkSurface.1", AA_UI, "focus ring on card"],
  ["focus.dark", "darkSurface.2", AA_UI, "focus ring on raised"],
  ["darkBorder.strong", "darkSurface.0", AA_UI, "input border vs page"],
  ["darkBorder.strong", "darkSurface.1", AA_UI, "input border vs card"],

  // ── Light theme: text on the surface ladder ─────────────────────────────
  ["lightText.primary", "lightSurface.0", AA_TEXT, "body on page"],
  ["lightText.primary", "lightSurface.1", AA_TEXT, "body on card"],
  ["lightText.primary", "lightSurface.2", AA_TEXT, "body on raised"],
  ["lightText.secondary", "lightSurface.0", AA_TEXT, "secondary on page"],
  ["lightText.secondary", "lightSurface.1", AA_TEXT, "secondary on card"],
  ["lightText.secondary", "lightSurface.2", AA_TEXT, "secondary on raised"],
  ["lightText.muted", "lightSurface.0", AA_TEXT, "muted on page"],
  ["lightText.muted", "lightSurface.1", AA_TEXT, "muted on card"],
  ["lightText.muted", "lightSurface.2", AA_TEXT, "muted on raised"],

  // ── Light theme: ink button, gold only where it can be read ────────────
  ["lightSurface.0", "ink.base", AA_TEXT, "CTA label on ink button"],
  ["lightSurface.0", "ink.hover", AA_TEXT, "CTA label on ink hover"],
  ["gold.800", "lightSurface.0", AA_TEXT, "gold link on page"],
  ["gold.800", "lightSurface.1", AA_TEXT, "gold link on card"],
  ["lightText.primary", "gold.500", AA_TEXT, "dark label on gold fill"],
  ["gold.700", "lightSurface.0", AA_UI, "gold rule/icon vs page"],

  // ── Light theme: semantic ───────────────────────────────────────────────
  ["semantic.successLight", "lightSurface.0", AA_TEXT, "success on page"],
  ["semantic.warningLight", "lightSurface.0", AA_TEXT, "warning on page"],
  ["semantic.dangerLight", "lightSurface.0", AA_TEXT, "danger on page"],
  ["semantic.infoLight", "lightSurface.0", AA_TEXT, "info on page"],

  // ── Light theme: structure ──────────────────────────────────────────────
  ["focus.light", "lightSurface.0", AA_UI, "focus ring on page"],
  ["focus.light", "lightSurface.1", AA_UI, "focus ring on card"],
  ["lightBorder.strong", "lightSurface.0", AA_UI, "input border vs page"],
  ["lightBorder.strong", "lightSurface.1", AA_UI, "input border vs card"],

  // ── The surface ladder must actually step ───────────────────────────────
  // Large fills, not text, so the bar is low — but a ladder whose rungs are
  // indistinguishable is what makes a dark site read as flat and cheap.
  ["darkSurface.1", "darkSurface.0", 1.15, "card lifts off page"],
  ["darkSurface.2", "darkSurface.1", 1.15, "raised lifts off card"],
  ["darkSurface.3", "darkSurface.2", 1.15, "hover lifts off raised"],
  ["darkSurface.4", "darkSurface.3", 1.15, "top rung lifts off hover"],
  ["lightSurface.1", "lightSurface.0", 1.02, "card lifts off page"],
  ["lightSurface.2", "lightSurface.1", 1.04, "raised lifts off card"],
  ["lightSurface.3", "lightSurface.2", 1.04, "hover lifts off raised"],
];

let failed = 0;
for (const [fgPath, bgPath, min, label] of checks) {
  const ratio = contrast(tok(fgPath), tok(bgPath));
  const ok = ratio >= min;
  if (!ok) failed++;
  const line = `${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ${fgPath} on ${bgPath}  — ${label}`;
  console.log(ok ? line : `\x1b[31m${line}\x1b[0m`);
}

console.log(
  `\n${checks.length - failed}/${checks.length} contrast checks passed.` +
    (failed ? `  \x1b[31m${failed} FAILED\x1b[0m` : "  \x1b[32mAll good.\x1b[0m"),
);
process.exit(failed > 0 ? 1 : 0);
