#!/usr/bin/env node
/**
 * The Sabicars identity, built from first principles: `npm run brand`.
 *
 * The SabiCars logo chosen by the founder on 2026-10-19: refined from an Inova
 * trainee concept — "Sabi" in Sabi Green, "Cars" in Sabi Orange, and the
 * concept's best idea redrawn as two mirrored speed blades: one off the S's
 * bottom bar, pointing back, one off the final s's top bar, pointing ahead, so
 * the name starts and finishes moving. The S with its blade is the mark, for
 * icons and avatars. The trademark was filed in black (all colours).
 *
 * Everything is outlined type and exact geometry, so no mark depends on a font
 * being installed:
 *
 * - The lettering is Exo 2 Black (SIL Open Font License, scripts/fonts/), laid
 *   out with the font's own spacing tightened by 6 units, converted to outlines.
 * - The blades are polygons in the font's own units, attached to the glyphs'
 *   bars, so they move with the lettering if it is ever re-spaced.
 * - The Verified seal keeps its ring lettering (scripts/fonts/seal-ring.json,
 *   already outlines) around the new mark.
 *
 * Writes the masters to /brand at the repository root, and the files the
 * platform uses to web/public/brand, web/src/app (favicons, share image) and
 * web/src/components/brand/marks.ts.
 */

import * as fontkit from "fontkit";
import sharp from "sharp";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, "..");
const BRAND = join(WEB, "..", "brand");
const palette = JSON.parse(readFileSync(join(WEB, "src", "styles", "palette.json"), "utf8"));

export const COLOURS = {
  green: palette.green["500"],
  orange: palette.orange["500"],
  deepGreen: "#558505",
  deepOrange: "#D45F00",
  sealGreen: palette.green["400"],
  night: palette.darkSurface["0"],
  bone: palette.darkText.primary,
  stone: palette.darkText.muted,
  ink: "#1B1B1B",
  white: "#FFFFFF",
};

// ── Numbers and SVG ───────────────────────────────────────────────────────

const n = (v) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 100) / 100));
const tidy = (d) => d.replace(/-?\d+\.?\d*(e-?\d+)?/g, (m) => n(parseFloat(m)));
const path = (d, fill) => `<path fill="${fill}" d="${d}"/>`;
function svg(w, h, body, { px } = {}) {
  const size = px ? ` width="${px[0]}" height="${px[1]}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}"${size}>${body}</svg>`;
}

// ── The lettering ─────────────────────────────────────────────────────────

const BLACK = fontkit.openSync(join(here, "fonts", "Exo2-Black.ttf"));
const BOLD = fontkit.openSync(join(here, "fonts", "Exo2-Bold.ttf"));
const TRACK = -6; // font units: a touch tighter than the font's own spacing
const BLADE = 290; // blade length, font units

/** Outlines a run of text, one SVG path per glyph, with the pen positions (font units, y up → SVG y down). */
function layout(font, text, size, track = 0) {
  const s = size / font.unitsPerEm;
  const run = font.layout(text);
  let x = 0;
  const glyphs = run.glyphs.map((g, i) => {
    const pos = run.positions[i];
    const gx = x + pos.xOffset * s;
    const d = g.path.transform(s, 0, 0, -s, gx, -pos.yOffset * s).toSVG();
    x += (pos.xAdvance + (i < run.glyphs.length - 1 ? track : 0)) * s;
    return { d, x: gx, s };
  });
  return { glyphs, width: x };
}

/**
 * The wordmark at cap-height-relative size: "Sabi" and "Cars" as separate paths
 * (so each takes its colour), each with its blade, baseline at y = 0.
 */
function wordmark(size = 100) {
  const L = layout(BLACK, "SabiCars", size, TRACK);
  const k = size / 1000;
  const S = L.glyphs[0], s = L.glyphs[7];
  const X = (g, u) => g.x + u * k, Y = (u) => -u * k;
  // S: its bottom bar ends at x 36–49, y 20–172. Blade: flat along the baseline, its top sloping down to a point behind.
  const sBlade = `M${n(X(S, 130))} ${n(Y(172))}L${n(X(S, 130))} ${n(Y(20))}L${n(X(S, 36 - BLADE))} ${n(Y(20))}Z`;
  // final s: its top bar ends at x 499–512, y 370–492. Blade: flat along the top, its underside rising to a point ahead.
  const eBlade = `M${n(X(s, 420))} ${n(Y(492))}L${n(X(s, 420))} ${n(Y(370))}L${n(X(s, 512 + BLADE))} ${n(Y(492))}Z`;
  const sabi = tidy(L.glyphs.slice(0, 4).map((g) => g.d).join(""));
  const cars = tidy(L.glyphs.slice(4).map((g) => g.d).join(""));
  const left = X(S, 36 - BLADE), right = X(s, 512 + BLADE), top = Y(729), bottom = Y(-14);
  return { sabi, cars, sBlade, eBlade, left, right, top, bottom };
}

/** The mark: the S and its blade. */
function mark(size = 100) {
  const L = layout(BLACK, "S", size);
  const g = L.glyphs[0], k = size / 1000;
  const X = (u) => g.x + u * k, Y = (u) => -u * k;
  const blade = `M${n(X(130))} ${n(Y(172))}L${n(X(130))} ${n(Y(20))}L${n(X(36 - BLADE))} ${n(Y(20))}Z`;
  return { s: tidy(g.d), blade, left: X(36 - BLADE), right: X(585), top: Y(704), bottom: Y(-14) };
}

/** Moves a path's absolute coordinates (the font paths are all absolute). */
function shift(d, dx, dy) {
  return d.replace(/([MLQCZ])([^MLQCZ]*)/gi, (_, cmd, args) => {
    const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    return cmd + nums.map((v, i) => n(i % 2 ? v + dy : v + dx)).join(" ");
  });
}

// ── Lock-ups ──────────────────────────────────────────────────────────────

const W = wordmark(100);
const PAD = 2;
// The wordmark box, origin at its top-left corner.
const WM = {
  width: W.right - W.left + PAD * 2,
  height: W.bottom - W.top + PAD * 2,
  dx: -W.left + PAD,
  dy: -W.top + PAD,
};
const wmPaths = {
  sabi: shift(W.sabi, WM.dx, WM.dy),
  cars: shift(W.cars, WM.dx, WM.dy),
  sBlade: shift(W.sBlade, WM.dx, WM.dy),
  eBlade: shift(W.eBlade, WM.dx, WM.dy),
};
const logo = (sabi, cars, bg) =>
  svg(
    WM.width,
    WM.height,
    (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : "") +
      // Each blade is its own shape: joined into the letter's path, the overlap would cancel into a notch.
      path(wmPaths.sabi, sabi) + path(wmPaths.sBlade, sabi) +
      path(wmPaths.cars, cars) + path(wmPaths.eBlade, cars),
  );

const M = mark(100);
const MK = { width: M.right - M.left, height: M.bottom - M.top, dx: -M.left, dy: -M.top };
const mkPaths = { s: shift(M.s, MK.dx, MK.dy), blade: shift(M.blade, MK.dx, MK.dy) };
const markSvg = (s, blade) => svg(MK.width, MK.height, path(mkPaths.s, s) + path(mkPaths.blade, blade));

/** The mark centred in a square tile, `fill` of the tile's width. */
function tile(size, { fill = 0.62, radius = 0, bg = COLOURS.night, s = COLOURS.green, blade = COLOURS.orange } = {}) {
  const k = (size * fill) / MK.width;
  const tx = size / 2 - (MK.width / 2) * k, ty = size / 2 - (MK.height / 2) * k;
  return svg(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${n(size * radius)}" fill="${bg}"/>` +
      `<g transform="translate(${n(tx)} ${n(ty)}) scale(${n(k)})">${path(mkPaths.s, s)}${path(mkPaths.blade, blade)}</g>`,
    { px: [size, size] },
  );
}

// The Verified seal: the ring lettering kept from the first identity, with the new mark at its centre.
const RING = JSON.parse(readFileSync(join(here, "fonts", "seal-ring.json"), "utf8"));
function seal(ring, s, blade, disc) {
  const k = 72 / MK.width; // the mark spans 72 of the seal's 200 units, inside the inner ring
  const tx = 100 - (MK.width / 2) * k, ty = 100 - (MK.height / 2) * k + 2;
  return svg(
    200,
    200,
    (disc ? `<circle cx="100" cy="100" r="99.5" fill="${disc}"/>` : "") +
      `<path fill="${ring}" fill-rule="evenodd" d="${RING.rings}"/>` +
      path(RING.text, ring) +
      `<g transform="translate(${n(tx)} ${n(ty)}) scale(${n(k)})">${path(mkPaths.s, s)}${path(mkPaths.blade, blade)}</g>`,
  );
}

/** A line of small type (Exo 2 Bold), centred on x, for the share image and lock-ups. */
function line(text, { size, track = 0, fill, cx, baseline }) {
  const L = layout(BOLD, text, size, track);
  const d = shift(tidy(L.glyphs.map((g) => g.d).join("")), cx - L.width / 2, baseline);
  return path(d, fill);
}

// ── Files ─────────────────────────────────────────────────────────────────

async function png(svgText, file, width, height, bg) {
  let img = sharp(Buffer.from(svgText), { density: 72 * 6 }).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (bg) img = img.flatten({ background: bg });
  mkdirSync(dirname(file), { recursive: true });
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

const { green, orange, deepGreen, deepOrange, sealGreen, night, bone, stone, ink, white } = COLOURS;

// Masters. The first identity's files (gold) are removed so nobody picks one up by mistake.
for (const dir of ["svg", "png", "icons", "social"]) rmSync(join(BRAND, dir), { recursive: true, force: true });
const masters = {
  "logo-on-dark.svg": logo(green, orange),
  "logo-on-light.svg": logo(deepGreen, deepOrange),
  "logo-black.svg": logo(ink, ink),
  "logo-white.svg": logo(white, white),
  "mark.svg": markSvg(green, orange),
  "mark-on-light.svg": markSvg(deepGreen, deepOrange),
  "mark-black.svg": markSvg(ink, ink),
  "mark-white.svg": markSvg(white, white),
  "seal-on-dark.svg": seal(sealGreen, green, orange),
  "seal-on-light.svg": seal(deepGreen, deepGreen, deepOrange),
  "seal-black.svg": seal(ink, ink, ink),
  "seal-white.svg": seal(white, white, white),
  "seal-on-night-disc.svg": seal(sealGreen, green, orange, night),
};
for (const [name, text] of Object.entries(masters)) write(join(BRAND, "svg", name), text);

const wmH = (w) => Math.round((w * WM.height) / WM.width);
await png(masters["logo-on-dark.svg"], join(BRAND, "png", "logo-on-dark-3000.png"), 3000, wmH(3000));
await png(masters["logo-on-light.svg"], join(BRAND, "png", "logo-on-light-3000.png"), 3000, wmH(3000));
await png(masters["logo-black.svg"], join(BRAND, "png", "logo-black-3000.png"), 3000, wmH(3000));
await png(masters["logo-white.svg"], join(BRAND, "png", "logo-white-3000.png"), 3000, wmH(3000));
await png(masters["seal-on-night-disc.svg"], join(BRAND, "png", "seal-on-night-3000.png"), 3000, 3000);
await png(masters["seal-on-light.svg"], join(BRAND, "png", "seal-on-light-3000.png"), 3000, 3000);

// Icons: the mark on Night. Favicons fill more of the tile, so the S still reads at 16px.
const favicon = (s) => tile(s, { fill: 0.78, radius: 0.22 });
for (const s of [16, 32, 48]) await png(favicon(s), join(BRAND, "icons", `favicon-${s}.png`), s, s);
await ico(join(BRAND, "icons", "favicon.ico"), [16, 32, 48], favicon);
write(join(BRAND, "icons", "favicon.svg"), favicon(64).replace(/ width="64" height="64"/, ""));
await png(tile(180, { fill: 0.64 }), join(BRAND, "icons", "apple-touch-icon-180.png"), 180, 180);
await png(tile(192, { fill: 0.64, radius: 0.22 }), join(BRAND, "icons", "icon-192.png"), 192, 192);
await png(tile(512, { fill: 0.64, radius: 0.22 }), join(BRAND, "icons", "icon-512.png"), 512, 512);
await png(tile(512, { fill: 0.5 }), join(BRAND, "icons", "icon-maskable-512.png"), 512, 512);

// Social: profile pictures (safe inside the circle every platform crops to) and the link preview.
await png(tile(1080, { fill: 0.5 }), join(BRAND, "social", "profile-1080.png"), 1080, 1080);
{
  const w = 860, k = w / WM.width, h = WM.height * k;
  const withName = svg(1080, 1080, `<rect width="1080" height="1080" fill="${night}"/><g transform="translate(${n(540 - w / 2)} ${n(540 - h / 2)}) scale(${n(k)})">${path(wmPaths.sabi, green)}${path(wmPaths.sBlade, green)}${path(wmPaths.cars, orange)}${path(wmPaths.eBlade, orange)}</g>`, { px: [1080, 1080] });
  await png(withName, join(BRAND, "social", "profile-with-name-1080.png"), 1080, 1080);
}
const ogW = 700, ogK = ogW / WM.width, ogH = WM.height * ogK;
const og = svg(
  1200,
  630,
  `<defs><radialGradient id="glow" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="${green}" stop-opacity="0.16"/><stop offset="1" stop-color="${green}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="1200" height="630" fill="${night}"/><rect width="1200" height="630" fill="url(#glow)"/>` +
    `<g transform="translate(${n(600 - ogW / 2)} ${n(280 - ogH / 2)}) scale(${n(ogK)})">${path(wmPaths.sabi, green)}${path(wmPaths.sBlade, green)}${path(wmPaths.cars, orange)}${path(wmPaths.eBlade, orange)}</g>` +
    line("HUMMER BUSES · LUXURY CARS · SUVS · TRUCKS", { size: 25, track: 220, fill: bone, cx: 600, baseline: 432 }) +
    line("SABICARS.COM · LAGOS", { size: 20, track: 260, fill: stone, cx: 600, baseline: 486 }) +
    `<rect x="560" y="512" width="80" height="4" rx="2" fill="${orange}"/>`,
  { px: [1200, 630] },
);
write(join(BRAND, "social", "share-1200x630.svg"), og);
await png(og, join(BRAND, "social", "share-1200x630.png"), 1200, 630);

// ── For the platform ───────────────────────────────────────────────────────

const PUBLIC = join(WEB, "public", "brand");
rmSync(join(PUBLIC, "seal-gold.svg"), { force: true });
// Email clients do not all render SVG: a PNG logo on the emails' own Night.
await png(logo(green, orange, night), join(PUBLIC, "logo-email.png"), 440, wmH(440));
write(join(PUBLIC, "seal.svg"), masters["seal-on-dark.svg"]);
await png(tile(192, { fill: 0.64, radius: 0.22 }), join(PUBLIC, "icon-192.png"), 192, 192);
await png(tile(512, { fill: 0.64, radius: 0.22 }), join(PUBLIC, "icon-512.png"), 512, 512);
await png(tile(512, { fill: 0.5 }), join(PUBLIC, "icon-maskable-512.png"), 512, 512);

// Next.js file conventions: these become the page's <link rel="icon"> tags and default share image.
const APP = join(WEB, "src", "app");
write(join(APP, "icon.svg"), favicon(64).replace(/ width="64" height="64"/, ""));
await ico(join(APP, "favicon.ico"), [16, 32, 48], favicon);
await png(tile(180, { fill: 0.64 }), join(APP, "apple-icon.png"), 180, 180);
await png(og, join(APP, "opengraph-image.png"), 1200, 630);

// The marks as data, for the site's own components.
write(
  join(WEB, "src", "components", "brand", "marks.ts"),
  `/**
 * GENERATED by scripts/build-brand.mjs — do not edit. Regenerate: npm run brand
 *
 * The SabiCars marks as path data, so the site draws them inline: sharp at any
 * size, coloured by CSS, and never a network request.
 */

/**
 * The wordmark in a ${n(WM.width)} × ${n(WM.height)} box: "Sabi" and its back blade, "Cars" and its front
 * blade. Draw each blade as its own path — joined to its letters, the overlap cancels into a notch.
 */
export const WORDMARK = {
  width: ${n(WM.width)},
  height: ${n(WM.height)},
  sabi: "${wmPaths.sabi}",
  sabiBlade: "${wmPaths.sBlade}",
  cars: "${wmPaths.cars}",
  carsBlade: "${wmPaths.eBlade}",
} as const;

/** The mark: the S and its blade, in a ${n(MK.width)} × ${n(MK.height)} box. */
export const MARK = {
  width: ${n(MK.width)},
  height: ${n(MK.height)},
  s: "${mkPaths.s}",
  blade: "${mkPaths.blade}",
} as const;
`,
);

console.log(`Brand built: ${Object.keys(masters).length} masters, icons, social, and the platform's files. Wordmark ${n(WM.width)} × ${n(WM.height)}.`);
