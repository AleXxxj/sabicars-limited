# Sabicars identity

Chosen by the owner on 26 September 2026. There are two marks, and each has one job:

- **The logo (the Road).** An S drawn from two perfect circles, with a centre line running through it like a road. The wordmark SABICARS sits beside it or beneath it. The logo is how Sabicars signs its name: website, signage, number-plate frames, letterheads, social profiles, uniforms.
- **The seal (Sabicars Verified).** The same S inside a ring that carries the CAC registration number. It has one job, which is proof. It goes on the windscreen of every delivered car, on receipts, on sale certificates and on inspection reports. It is never used as the logo.

In Pidgin, *sabi* means to know. Both marks come from one idea: the people who know cars, with every deal on record.

## Files

Everything here is generated from exact geometry by `web/scripts/build-brand.mjs`. Rebuild it with `cd web && npm run brand`. Never edit the files by hand, and never redraw the marks.

| Need | File |
| --- | --- |
| Logo on black or dark photos | `svg/logo-horizontal-on-dark.svg`, `png/logo-horizontal-on-dark-2400.png` |
| Logo on white or ivory | `svg/logo-horizontal-on-light.svg`, `png/logo-horizontal-on-light-2400.png` |
| Logo in one colour (stamps, embroidery, engraving, fax) | `svg/logo-horizontal-black.svg`, `…-white.svg`, `…-gold.svg` |
| Stacked logo (square spaces, signboards, social) | `svg/logo-stacked-*.svg`, `png/logo-stacked-on-dark-1600.png` |
| Symbol alone | `svg/symbol-gold.svg` (plus `-black`, `-white`, `-deep-gold`) |
| Symbol, small sizes | `svg/symbol-small-*.svg` (solid, no centre line) |
| Verification seal | `svg/seal-gold.svg`, `-black`, `-white`; print sticker `svg/seal-gold-on-black-disc.svg` |
| Seal, small sizes | `svg/seal-small-gold.svg`, `-black` (ring and S only) |
| Browser and app icons | `icons/` (favicon.ico, favicon.svg, 16/32/48, apple-touch 180, 192, 512, maskable 512) |
| WhatsApp, Instagram, TikTok and Facebook profile picture | `social/profile-with-name-1080.png` (the S and the name, for the switch from the old ring logo) or `social/profile-1080.png` (the S alone, once the new mark is known). Both are safe in a circle crop. |
| Link preview image | `social/share-1200x630.png` |

Printers and signwriters should always get the **SVG**. The PNGs are for screens and quick use.

## Colour

| | Hex | Use |
| --- | --- | --- |
| Sabicars Gold | `#C9A84C` | The S, on black or dark grounds. For print, match it with the printer from the hex (approximately C0 M16 Y62 K21) on a proof. Gold foil is fine for stickers and premium print. |
| Showroom Black | `#0A0908` | The ground. For print use rich black. |
| Ivory | `#F5F2EA` | The wordmark on dark. |
| Deep Gold | `#8A7029` | The S on white or ivory. Plain gold on white is too faint to read. |

## Space and size

- **Clear space.** Keep an empty margin on every side, at least as tall as the capital letters of the wordmark. For the symbol alone, the margin is a quarter of its height.
- **The centre line** needs room to be seen:
  - On screen, use `symbol-*` at 32px tall and above (sharp phone screens).
  - In print, use it at 12 mm and above.
  - Below those sizes, use `symbol-small-*`. The favicons already do this.
- **The horizontal logo** should be at least 140px wide on screen and 35 mm wide in print.
- **The seal**:
  - The full seal with its lettering needs at least 64px on screen and 20 mm in print.
  - Below that, use `seal-small-*`.
  - The windscreen sticker should be about 80–100 mm across.

## Never

- Add gloss, gradients, shadows, glows or 3D effects to the marks. The flat gold is the logo.
- Stretch, squash, rotate, outline or rearrange them.
- Retype the wordmark. It is outlined lettering: Archivo at width 125, weight 600, spaced +300. It is not a font setting.
- Put the gold S on white; use Deep Gold. Don't put either mark on a busy photograph without a dark scrim behind it.
- Change the seal's wording, or use the seal as the main logo.
- Bring back the earlier marks (the gold "ELITE AUTO DEALER" ring, or the glossy S).

## Type around the marks

The site sets headlines in **Cormorant Garamond** and everything else in **Archivo**, both from Google Fonts under the SIL Open Font License. Use the same pair in documents and signage.

## Before print and registration

Run a trademark search, and file both marks with the Nigerian Trademarks, Patents and Designs Registry before large print runs or signage.
