#!/usr/bin/env node
/**
 * Generates src/styles/tokens.css from src/styles/palette.json.
 *
 * palette.json is the single source of truth. The CSS is generated so the two
 * cannot drift apart — the failure mode where someone nudges a hex in a
 * stylesheet and silently breaks a contrast guarantee the checker had proven.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const p = JSON.parse(readFileSync(join(here, "../src/styles/palette.json"), "utf8"));
const out = join(here, "../src/styles/tokens.css");

const keys = (obj) => Object.keys(obj).filter((k) => !k.startsWith("$"));
const ramp = (name, obj) => keys(obj).map((k) => `  --${name}-${k}: ${obj[k]};`).join("\n");

const css = `/* ─────────────────────────────────────────────────────────────────────────
   GENERATED FILE — do not edit.
   Source: src/styles/palette.json · Regenerate: npm run tokens
   Validated by: npm run check:contrast
   ───────────────────────────────────────────────────────────────────────── */

:root {
  /* Sabicars gold. 500 is the brand colour the logo already uses. */
${ramp("gold", p.gold)}

  /* The hero is photography, and photography needs a dark scrim to carry white
     type — in either theme. A light wash over a vehicle is what made the old
     hero look faded, so the hero keeps this treatment regardless of theme. */
  --hero-scrim: linear-gradient(
    100deg,
    rgb(11 10 9 / 0.92) 0%,
    rgb(11 10 9 / 0.78) 36%,
    rgb(11 10 9 / 0.38) 66%,
    rgb(11 10 9 / 0.12) 100%
  );
  --hero-scrim-bottom: linear-gradient(to top, rgb(11 10 9 / 0.9) 0%, rgb(11 10 9 / 0) 45%);
  --hero-text: ${p.darkText.primary};
  --hero-text-secondary: ${p.darkText.secondary};
}

/* ── Dark theme (default) ────────────────────────────────────────────── */
:root,
[data-theme="dark"] {
  color-scheme: dark;

${ramp("surface", p.darkSurface)}

  --text-primary: ${p.darkText.primary};
  --text-secondary: ${p.darkText.secondary};
  --text-muted: ${p.darkText.muted};

  --border-subtle: ${p.darkBorder.subtle};
  --border-default: ${p.darkBorder.default};
  --border-strong: ${p.darkBorder.strong};

  --focus: ${p.focus.dark};

  /* Gold carries the one action that matters on each screen. */
  --cta-bg: var(--gold-500);
  --cta-bg-hover: var(--gold-400);
  --cta-fg: ${p.darkSurface["0"]};
  --accent-text: var(--gold-400);
  --link: var(--gold-400);

  --success: ${p.semantic.successDark};
  --warning: ${p.semantic.warningDark};
  --danger: ${p.semantic.dangerDark};
  --info: ${p.semantic.infoDark};

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.45);
  --shadow-md: 0 6px 18px rgb(0 0 0 / 0.5);
  --shadow-lg: 0 24px 60px rgb(0 0 0 / 0.6);
}

/* ── Light theme ─────────────────────────────────────────────────────── */
[data-theme="light"] {
  color-scheme: light;

${ramp("surface", p.lightSurface)}

  --text-primary: ${p.lightText.primary};
  --text-secondary: ${p.lightText.secondary};
  --text-muted: ${p.lightText.muted};

  --border-subtle: ${p.lightBorder.subtle};
  --border-default: ${p.lightBorder.default};
  --border-strong: ${p.lightBorder.strong};

  --focus: ${p.focus.light};

  /* Gold text on white fails at body sizes, so on light the action is ink —
     the convention of the marques — and gold becomes a rule, an icon, a fill. */
  --cta-bg: ${p.ink.base};
  --cta-bg-hover: ${p.ink.hover};
  --cta-fg: ${p.lightSurface["0"]};
  --accent-text: var(--gold-800);
  --link: var(--gold-800);

  --success: ${p.semantic.successLight};
  --warning: ${p.semantic.warningLight};
  --danger: ${p.semantic.dangerLight};
  --info: ${p.semantic.infoLight};

  --shadow-sm: 0 1px 2px rgb(21 19 15 / 0.06);
  --shadow-md: 0 6px 18px rgb(21 19 15 / 0.09);
  --shadow-lg: 0 24px 60px rgb(21 19 15 / 0.14);
}

/* Expose tokens to Tailwind utilities: bg-surface-1, text-muted, bg-cta … */
@theme inline {
${keys(p.gold).map((k) => `  --color-gold-${k}: var(--gold-${k});`).join("\n")}
${keys(p.darkSurface).map((k) => `  --color-surface-${k}: var(--surface-${k});`).join("\n")}
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-focus: var(--focus);
  --color-cta: var(--cta-bg);
  --color-cta-hover: var(--cta-bg-hover);
  --color-cta-fg: var(--cta-fg);
  --color-accent-text: var(--accent-text);
  --color-link: var(--link);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-info: var(--info);
}
`;

writeFileSync(out, css, "utf8");
console.log(`Wrote ${out}`);
