#!/usr/bin/env node
/**
 * The Sabicars identity, built from first principles: `npm run brand`.
 *
 * Chosen by the owner on 2026-09-26 — the Road as the logo, the Seal as the
 * verification mark (see brand/README.md for how to use them).
 *
 * Everything is exact geometry or outlined type, so no mark depends on a font
 * being installed or on a designer's copy of a file:
 *
 * - The S is two circles of radius 21 that touch at the centre. Its stroke is
 *   built as filled bands (concentric arcs), with the road's centre line a
 *   real gap — so it can be cut in vinyl, stitched and engraved, not only
 *   drawn on screen. Below 40px the solid master replaces it.
 * - The wordmark is Archivo (SIL Open Font License) at width 125, weight 600,
 *   tracked +300, converted to outlines. It is read from the font the site
 *   itself ships, so the logo and the site set type identically.
 * - The seal's ring text is laid out glyph by glyph on its circle.
 *
 * Writes the masters to /brand at the repository root, and the files the
 * platform uses to web/public/brand, web/src/app (favicons) and
 * web/src/components/brand/marks.ts.
 *
 * Needs a Next.js build or dev run first (for the cached Archivo font).
 */

import * as fontkit from "fontkit";
import sharp from "sharp";
import { decompress } from "wawoff2";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, "..");
const BRAND = join(WEB, "..", "brand");

export const COLOURS = { gold: "#C9A84C", deepGold: "#8A7029", black: "#0A0908", ivory: "#F5F2EA", white: "#FFFFFF" };

// ── Numbers ────────────────────────────────────────────────────────────────

const n = (v) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 100) / 100));
const rad = (deg) => (deg * Math.PI) / 180;
/** Rounds every number in a path string: masters stay small and diff-friendly. */
const tidy = (d) => d.replace(/-?\d+\.?\d*(e-?\d+)?/g, (m) => n(parseFloat(m)));

// ── The font ───────────────────────────────────────────────────────────────

/**
 * Archivo as the site ships it (a variable WOFF2 from next/font). fontkit can
 * only make width/weight instances from a plain TrueType font, so the WOFF2 is
 * decompressed first with Google's own decoder (wawoff2).
 */
async function archivo() {
  const dir = join(WEB, ".next/static/media");
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".woff2"));
  } catch {
    /* handled below */
  }
  for (const f of files) {
    try {
      const probe = fontkit.openSync(join(dir, f));
      if (!(probe.familyName.startsWith("Archivo") && probe.variationAxes?.wdth && probe.hasGlyphForCodePoint(0xb7))) continue;
      return fontkit.create(Buffer.from(await decompress(readFileSync(join(dir, f)))));
    } catch {
      /* not a font we can read */
    }
  }
  throw new Error("Archivo not found in .next/static/media — run `npm run dev` or `npm run build` once, then try again.");
}

const base = await archivo();

/**
 * A line of text as one outlined path, starting at x=0 on the baseline (y=0),
 * y downwards. Returns the path and its ink bounds.
 */
function outline(text, { size, wdth, wght, tracking = 0 }) {
  const font = base.getVariation({ wdth, wght });
  const run = font.layout(text);
  const s = size / font.unitsPerEm;
  let x = 0;
  const parts = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const gx = x + pos.xOffset * s;
    const p = g.path.transform(s, 0, 0, -s, gx, -pos.yOffset * s);
    const b = p.bbox;
    if (Number.isFinite(b.minX)) {
      minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
    }
    parts.push(p.toSVG());
    x += pos.xAdvance * s + (i < run.glyphs.length - 1 ? tracking * size : 0);
  });
  return { d: tidy(parts.join("")), minX, maxX, minY, maxY, capHeight: (font.capHeight / font.unitsPerEm) * size };
}

/**
 * Text on an arc of a circle, centred on an angle, the way a seal is lettered:
 * across the top it runs clockwise with the letters standing outward; across
 * the bottom it runs the other way with the letters standing inward, so both
 * lines read left to right, upright. Both occupy the same band of the ring.
 */
function arcText(text, { cx, cy, r, size, wdth, wght, tracking = 0, at }) {
  const font = base.getVariation({ wdth, wght });
  const run = font.layout(text);
  const s = size / font.unitsPerEm;
  const cap = (font.capHeight / font.unitsPerEm) * size;
  const advances = run.positions.map((p, i) => p.xAdvance * s + (i < run.glyphs.length - 1 ? tracking * size : 0));
  const total = advances.reduce((a, b) => a + b, 0) - 0;
  const top = at === "top";
  // Bottom letters hang inward from a baseline one cap-height further out, filling the same band.
  const radius = top ? r : r + cap;
  const centre = top ? (3 * Math.PI) / 2 : Math.PI / 2;
  let along = 0;
  const parts = [];
  run.glyphs.forEach((g, i) => {
    const w = run.positions[i].xAdvance * s;
    const mid = along + w / 2;
    const theta = top ? centre - total / 2 / radius + mid / radius : centre + total / 2 / radius - mid / radius;
    const phi = top ? theta + Math.PI / 2 : theta - Math.PI / 2;
    const px = cx + radius * Math.cos(theta), py = cy + radius * Math.sin(theta);
    const ex = px - (w / 2) * Math.cos(phi), ey = py - (w / 2) * Math.sin(phi);
    parts.push(g.path.transform(s * Math.cos(phi), s * Math.sin(phi), s * Math.sin(phi), -s * Math.cos(phi), ex, ey).toSVG());
    along += advances[i];
  });
  return { d: tidy(parts.join("")), cap };
}

// ── The S ──────────────────────────────────────────────────────────────────

const R = 21, START = -25, END = 155; // degrees; the terminals are cut on the radius
const C1 = [60, 39], C2 = [60, 81];

/**
 * One band of the S: arc 1 at radii (a, b) continuing into arc 2 at (42-a,
 * 42-b) — at the centre the outside of one circle is the inside of the other.
 * `k`, `tx`, `ty` place it (uniform scale, then offset).
 */
function band(a, b, k = 1, tx = 0, ty = 0) {
  const P = (c, r, deg) => `${n(tx + k * (c[0] + r * Math.cos(rad(deg))))} ${n(ty + k * (c[1] + r * Math.sin(rad(deg))))}`;
  const A = (r) => n(k * r);
  const a2 = 2 * R - a, b2 = 2 * R - b;
  return (
    `M${P(C1, a, START)}` +
    `A${A(a)} ${A(a)} 0 1 0 ${P(C1, a, 90)}` +
    `A${A(a2)} ${A(a2)} 0 1 1 ${P(C2, a2, END)}` +
    `L${P(C2, b2, END)}` +
    `A${A(b2)} ${A(b2)} 0 1 0 ${P(C2, b2, -90)}` +
    `A${A(b)} ${A(b)} 0 1 1 ${P(C1, b, START)}Z`
  );
}

const HALF = 6.5, LANE = 0.85; // stroke 13, centre line 1.7
/** The S with its centre line, for 40px and up. Ink box in the 120 grid: x 32.5–87.5, y 11.5–108.5. */
const sRoad = (k, tx, ty) => band(R + HALF, R + LANE, k, tx, ty) + band(R - LANE, R - HALF, k, tx, ty);
/** The solid S for small sizes: one band, stroke 16. */
const sSolid = (k, tx, ty) => band(R + 8, R - 8, k, tx, ty);
const S_INK = { x: 32.5, y: 11.5, w: 55, h: 97 };

// ── Lockups ────────────────────────────────────────────────────────────────

/** Horizontal logo: the S 100 units tall; the wordmark's capitals a third of that, centred on it. */
function horizontal() {
  const k = 100 / S_INK.h;
  const s = sRoad(k, -S_INK.x * k, -S_INK.y * k);
  const cap = 100 / 3.2;
  const probe = outline("SABICARS", { size: 100, wdth: 125, wght: 600, tracking: 0.3 });
  const size = (cap / probe.capHeight) * 100;
  const wm = outline("SABICARS", { size, wdth: 125, wght: 600, tracking: 0.3 });
  const gap = cap * 1.25;
  const x0 = S_INK.w * k + gap - wm.minX;
  const baseline = 50 + cap / 2;
  const moved = translatePath(wm.d, x0, baseline);
  return { width: n(x0 + wm.maxX), height: 100, s, wordmark: moved };
}

/** Stacked logo: the S above, the wordmark centred beneath. */
function stacked() {
  const k = 100 / S_INK.h;
  const probe = outline("SABICARS", { size: 100, wdth: 125, wght: 600, tracking: 0.3 });
  const cap = 22;
  const size = (cap / probe.capHeight) * 100;
  const wm = outline("SABICARS", { size, wdth: 125, wght: 600, tracking: 0.3 });
  const width = wm.maxX - wm.minX;
  const sx = (width - S_INK.w * k) / 2;
  const s = sRoad(k, sx - S_INK.x * k, -S_INK.y * k);
  const baseline = 100 + 28 + cap;
  return { width: n(width), height: n(baseline), s, wordmark: translatePath(wm.d, -wm.minX, baseline) };
}

/** Offsets every coordinate pair of an absolute path (the outliner only emits M, L, Q, C, Z). */
function translatePath(d, dx, dy) {
  return d.replace(/([MLQC])([^MLQCZ]*)/g, (_, cmd, args) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out = nums.map((v, i) => n(v + (i % 2 === 0 ? dx : dy)));
    return cmd + out.join(" ");
  });
}

// ── The seal ───────────────────────────────────────────────────────────────

const ring = (cx, cy, r1, r2) =>
  `M${n(cx - r2)} ${cy}A${r2} ${r2} 0 1 1 ${n(cx + r2)} ${cy}A${r2} ${r2} 0 1 1 ${n(cx - r2)} ${cy}Z` +
  `M${n(cx - r1)} ${cy}A${r1} ${r1} 0 1 0 ${n(cx + r1)} ${cy}A${r1} ${r1} 0 1 0 ${n(cx - r1)} ${cy}Z`;

function seal() {
  const k = 112 / 120;
  const type = { cx: 100, cy: 100, r: 77, size: 12.5, wdth: 112, wght: 700, tracking: 0.14 };
  const topLine = arcText("SABICARS VERIFIED", { ...type, at: "top" });
  const bottomLine = arcText("CAC RC 1560100 · LAGOS", { ...type, at: "bottom" });
  // Two small discs at 3 and 9 o'clock divide the lines, centred in the lettering band.
  const dot = (x, y) => `M${n(x - 2.3)} ${n(y)}a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0Z`;
  const band = 77 + topLine.cap / 2;
  return {
    rings: ring(100, 100, 93.5, 96.5) + ring(100, 100, 61.4, 62.6),
    text: topLine.d + bottomLine.d + dot(100 - band, 100) + dot(100 + band, 100),
    s: sRoad(k, 44, 44),
  };
}
function sealSmall() {
  const k = 140 / 120;
  return { rings: ring(100, 100, 82, 94), s: sSolid(k, 30, 30) };
}

// ── Composing files ────────────────────────────────────────────────────────

const svg = (w, h, body, { px } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${px ? ` width="${px[0]}" height="${px[1]}"` : ""}>${body}</svg>\n`;
const path = (d, fill, rule) => `<path fill="${fill}"${rule ? ` fill-rule="${rule}"` : ""} d="${d}"/>`;

const H = horizontal();
const ST = stacked();
const SEAL = seal();
const SEAL_S = sealSmall();
const SYMBOL = sRoad(1, 0, 0);
const SYMBOL_SOLID = sSolid(1, 0, 0);

const logoH = (s, w, bg) => svg(H.width, H.height, (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : "") + path(H.s, s) + path(H.wordmark, w));
const logoS = (s, w) => svg(ST.width, ST.height, path(ST.s, s) + path(ST.wordmark, w));
const symbol = (c, solid = false) => svg(120, 120, path(solid ? SYMBOL_SOLID : SYMBOL, c));
const sealSvg = (c, disc) => svg(200, 200, (disc ? `<circle cx="100" cy="100" r="99.5" fill="${disc}"/>` : "") + path(SEAL.rings, c, "evenodd") + path(SEAL.text, c) + path(SEAL.s, c));
const sealSmallSvg = (c) => svg(200, 200, path(SEAL_S.rings, c, "evenodd") + path(SEAL_S.s, c));

/** An icon tile: the S centred on black, `fill` of the tile's height, optionally with rounded corners. */
function tile(size, { fill = 0.62, radius = 0, solid = false, bg = COLOURS.black } = {}) {
  const h = size * fill;
  const k = h / S_INK.h;
  const tx = size / 2 - (S_INK.x + S_INK.w / 2) * k, ty = size / 2 - (S_INK.y + S_INK.h / 2) * k;
  const d = solid ? sSolid(k, tx, ty) : sRoad(k, tx, ty);
  return svg(size, size, `<rect width="${size}" height="${size}" rx="${n(size * radius)}" fill="${bg}"/>` + path(d, COLOURS.gold), { px: [size, size] });
}

async function png(svgText, file, width, height) {
  let img = sharp(Buffer.from(svgText), { density: 72 * 4 }).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  await img.png({ compressionLevel: 9 }).toFile(file);
}

/** A .ico holding PNG images (supported by every browser that still asks for one). */
async function ico(file, sizes, make) {
  const images = await Promise.all(sizes.map((s) => sharp(Buffer.from(make(s))).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i, s = sizes[i];
    header.writeUInt8(s >= 256 ? 0 : s, e); header.writeUInt8(s >= 256 ? 0 : s, e + 1);
    header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  writeFileSync(file, Buffer.concat([header, ...images]));
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const { gold, deepGold, black, ivory, white } = COLOURS;

// Masters.
const masters = {
  "logo-horizontal-on-dark.svg": logoH(gold, ivory),
  "logo-horizontal-on-light.svg": logoH(deepGold, black),
  "logo-horizontal-gold.svg": logoH(gold, gold),
  "logo-horizontal-black.svg": logoH(black, black),
  "logo-horizontal-white.svg": logoH(white, white),
  "logo-stacked-on-dark.svg": logoS(gold, ivory),
  "logo-stacked-on-light.svg": logoS(deepGold, black),
  "logo-stacked-black.svg": logoS(black, black),
  "logo-stacked-white.svg": logoS(white, white),
  "symbol-gold.svg": symbol(gold),
  "symbol-black.svg": symbol(black),
  "symbol-white.svg": symbol(white),
  "symbol-deep-gold.svg": symbol(deepGold),
  "symbol-small-gold.svg": symbol(gold, true),
  "symbol-small-black.svg": symbol(black, true),
  "symbol-small-white.svg": symbol(white, true),
  "seal-gold.svg": sealSvg(gold),
  "seal-black.svg": sealSvg(black),
  "seal-white.svg": sealSvg(white),
  "seal-gold-on-black-disc.svg": sealSvg(gold, black),
  "seal-small-gold.svg": sealSmallSvg(gold),
  "seal-small-black.svg": sealSmallSvg(black),
};
for (const [name, text] of Object.entries(masters)) write(join(BRAND, "svg", name), text);

// Raster exports.
mkdirSync(join(BRAND, "png"), { recursive: true });
mkdirSync(join(BRAND, "icons"), { recursive: true });
mkdirSync(join(BRAND, "social"), { recursive: true });
const hw = Number(H.width), sw = Number(ST.width), sh = Number(ST.height);
await png(masters["logo-horizontal-on-dark.svg"], join(BRAND, "png", "logo-horizontal-on-dark-2400.png"), 2400, Math.round((2400 * 100) / hw));
await png(masters["logo-horizontal-on-light.svg"], join(BRAND, "png", "logo-horizontal-on-light-2400.png"), 2400, Math.round((2400 * 100) / hw));
await png(masters["logo-horizontal-white.svg"], join(BRAND, "png", "logo-horizontal-white-2400.png"), 2400, Math.round((2400 * 100) / hw));
await png(masters["logo-stacked-on-dark.svg"], join(BRAND, "png", "logo-stacked-on-dark-1600.png"), 1600, Math.round((1600 * sh) / sw));
await png(masters["symbol-gold.svg"], join(BRAND, "png", "symbol-gold-1024.png"), 1024, 1024);
await png(masters["seal-gold.svg"], join(BRAND, "png", "seal-gold-3000.png"), 3000, 3000);
await png(masters["seal-gold-on-black-disc.svg"], join(BRAND, "png", "seal-gold-on-black-3000.png"), 3000, 3000);

// Icons.
// Favicons are drawn at 1–2× pixel density: below 64px the centre line would only blur.
const favicon = (s) => tile(s, { fill: 0.74, radius: 0.22, solid: s < 64 });
await png(favicon(16), join(BRAND, "icons", "favicon-16.png"), 16, 16);
await png(favicon(32), join(BRAND, "icons", "favicon-32.png"), 32, 32);
await png(favicon(48), join(BRAND, "icons", "favicon-48.png"), 48, 48);
await ico(join(BRAND, "icons", "favicon.ico"), [16, 32, 48], favicon);
write(join(BRAND, "icons", "favicon.svg"), tile(64, { fill: 0.74, radius: 0.22, solid: true }).replace(/ width="64" height="64"/, ""));
await png(tile(180, { fill: 0.58 }), join(BRAND, "icons", "apple-touch-icon-180.png"), 180, 180);
await png(tile(192, { fill: 0.62, radius: 0.22 }), join(BRAND, "icons", "icon-192.png"), 192, 192);
await png(tile(512, { fill: 0.62, radius: 0.22 }), join(BRAND, "icons", "icon-512.png"), 512, 512);
await png(tile(512, { fill: 0.48 }), join(BRAND, "icons", "icon-maskable-512.png"), 512, 512);

// Social: profile picture (safe inside a circle crop) and the default link preview.
await png(tile(1080, { fill: 0.5 }), join(BRAND, "social", "profile-1080.png"), 1080, 1080);
// For the switch from the old ring logo: people know Sabicars on social media by
// its name, so the first profile picture carries the name with the S — sized
// to sit inside the circle every platform crops to.
{
  // As large as the circle allows at the wordmark's corners: it must read in a 40px avatar.
  const lockupW = 820, k = lockupW / sw, lockupH = sh * k;
  const withName = svg(
    1080,
    1080,
    `<rect width="1080" height="1080" fill="${black}"/>` +
      `<g transform="translate(${n(540 - lockupW / 2)} ${n(540 - lockupH / 2)}) scale(${n(k)})">${path(ST.s, gold)}${path(ST.wordmark, ivory)}</g>`,
    { px: [1080, 1080] },
  );
  await png(withName, join(BRAND, "social", "profile-with-name-1080.png"), 1080, 1080);
}
const domain = outline("SABICARS.COM", { size: 20, wdth: 112, wght: 500, tracking: 0.28 });
const ogLogoW = 640, ogScale = ogLogoW / hw;
const og = svg(
  1200,
  630,
  `<rect width="1200" height="630" fill="${black}"/>` +
    `<g transform="translate(${n(600 - ogLogoW / 2)} ${n(300 - 50 * ogScale)}) scale(${n(ogScale)})">${path(H.s, gold)}${path(H.wordmark, ivory)}</g>` +
    `<g transform="translate(${n(600 - (domain.maxX + domain.minX) / 2)} 470)">${path(domain.d, deepGold)}</g>`,
  { px: [1200, 630] },
);
write(join(BRAND, "social", "share-1200x630.svg"), og);
await png(og, join(BRAND, "social", "share-1200x630.png"), 1200, 630);

// ── For the platform ───────────────────────────────────────────────────────

const PUBLIC = join(WEB, "public", "brand");
mkdirSync(PUBLIC, { recursive: true });
// Email clients do not all render SVG: a PNG logo on the emails' own black.
await png(logoH(gold, ivory, black), join(PUBLIC, "logo-email.png"), 440, Math.round((440 * 100) / hw));
write(join(PUBLIC, "seal-gold.svg"), masters["seal-gold.svg"]);
await png(tile(192, { fill: 0.62, radius: 0.22 }), join(PUBLIC, "icon-192.png"), 192, 192);
await png(tile(512, { fill: 0.62, radius: 0.22 }), join(PUBLIC, "icon-512.png"), 512, 512);
await png(tile(512, { fill: 0.48 }), join(PUBLIC, "icon-maskable-512.png"), 512, 512);

// Next.js file conventions: these become the page's <link rel="icon"> tags and default share image.
const APP = join(WEB, "src", "app");
write(join(APP, "icon.svg"), tile(64, { fill: 0.74, radius: 0.22, solid: true }).replace(/ width="64" height="64"/, ""));
await ico(join(APP, "favicon.ico"), [16, 32, 48], favicon);
await png(tile(180, { fill: 0.58 }), join(APP, "apple-icon.png"), 180, 180);
await png(og, join(APP, "opengraph-image.png"), 1200, 630);

// The marks as data, for the site's own components.
write(
  join(WEB, "src", "components", "brand", "marks.ts"),
  `/**
 * GENERATED by scripts/build-brand.mjs — do not edit. Regenerate: npm run brand
 *
 * The Sabicars marks as path data, so the site draws them inline: sharp at any
 * size, coloured by CSS, and never a network request.
 */

/** Horizontal logo: the S (${"`s`"}) and the wordmark, in a ${H.width} × 100 box. */
export const LOGO = {
  width: ${H.width},
  height: 100,
  s: "${H.s}",
  wordmark: "${H.wordmark}",
} as const;

/** The S alone, in a 120 × 120 box: with its centre line, and the solid master for small sizes. */
export const SYMBOL = { road: "${SYMBOL}", solid: "${SYMBOL_SOLID}" } as const;

/** The verification seal, in a 200 × 200 box. \`rings\` uses the even-odd rule. */
export const SEAL = { rings: "${SEAL.rings}", text: "${SEAL.text}", s: "${SEAL.s}" } as const;
`,
);

console.log(`Brand built: ${Object.keys(masters).length} vector masters, PNG exports, icons and social images in /brand; platform assets updated.`);
