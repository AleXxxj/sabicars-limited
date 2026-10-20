# Sabicars identity

The SabiCars logo was chosen by the founder on 19 October 2026. It was refined from an Inova trainee concept, and it replaces the gold "Road" identity of September 2026. There are three marks, and each has one job:

- **The logo (the wordmark).** "Sabi" is in Sabi Green and "Cars" is in Sabi Orange. Two mirrored speed blades run from it: one off the bottom bar of the S, pointing back, and one off the top bar of the final s, pointing ahead. The name starts and finishes moving. The logo is how Sabicars signs its name: website, signage, number-plate frames, letterheads, uniforms.
- **The mark (the S and its blade).** A green S with its orange blade. It goes where the full name won't fit: app icon, favicon, social profile picture, watermark.
- **The seal (Sabicars Verified).** The mark inside a ring that carries the CAC registration number. It has one job, which is proof. It goes on the windscreen of every delivered car, on receipts, on sale certificates and on inspection reports. It is never used as the logo.

In Pidgin, *sabi* means to know. The name and the marks come from one idea: the people who know cars, with every deal on record.

## Files

Everything in `svg/`, `png/`, `icons/` and `social/` is generated from outlined lettering and exact geometry by `web/scripts/build-brand.mjs`. Rebuild it with `cd web && npm run brand`. Never edit the files by hand, and never redraw the marks.

| Need | File |
| --- | --- |
| Logo on Night, black or dark photos | `svg/logo-on-dark.svg`, `png/logo-on-dark-3000.png` |
| Logo on white or paper | `svg/logo-on-light.svg`, `png/logo-on-light-3000.png` (the deep tones) |
| Logo in one colour (stamps, embroidery, engraving, fax) | `svg/logo-black.svg`, `svg/logo-white.svg` |
| The mark alone | `svg/mark.svg`, `-on-light`, `-black`, `-white` |
| Verification seal | `svg/seal-on-dark.svg`, `-on-light`, `-black`, `-white` |
| Seal as a print sticker | `svg/seal-on-night-disc.svg`, `png/seal-on-night-3000.png` |
| Browser and app icons | `icons/`: favicon.ico, favicon.svg, 16, 32 and 48 px, apple-touch 180, 192, 512, maskable 512 |
| WhatsApp, Instagram, TikTok and Facebook profile picture | `social/profile-with-name-1080.png` (the name), or `social/profile-1080.png` (the mark alone). Both are safe in a circle crop. |
| Link preview image | `social/share-1200x630.png` |
| Trademark filing and approval sheet | `logo-orange-green/`: the filed black logo, the logo sheet and the brand direction board |

Printers and signwriters should always get the **SVG**. The PNGs are for screens and quick use.

## Colour

Night leads, green speaks and orange acts. That restraint is what makes two bright colours read as authority, not as a toy shop.

| | Hex | Use |
| --- | --- | --- |
| Sabi Green | `#78B030` | The logo's "Sabi", the S of the mark, the seal. On screen it is also the brand's voice: labels, links, Verified. Nearest Pantone 368 C. Confirm against the printer's swatch. |
| Sabi Orange | `#F7801E` | The logo's "Cars" and the blade. On screen it is the action, and only the action: the button you should press. Nearest Pantone 1495 C. |
| Night | `#090E0A` | The ground: near-black with a whisper of green. For print, use rich black. |
| Bone | `#F2F2EC` | Text on Night. |
| Deep Green / Deep Orange | `#558505` / `#D45F00` | The logo on white and paper. The bright tones are too faint on white. |

Rough proportions on any page or printed piece: Night 62%, Bone 24%, green 9%, orange 5%. Never set the two brand colours side by side as large blocks.

## Space and size

- **Clear space.** Keep an empty margin on every side at least as tall as the letter "a". For the mark alone, the margin is a quarter of its height.
- **Minimum size.** The logo should be at least 100 px wide on screen and 20 mm wide in print. The mark and the seal need at least 24 px and 64 px on screen.
- **The windscreen sticker** should be about 80–100 mm across.

## Never

- Add gloss, gradients, shadows, glows or 3D effects to the marks.
- Stretch, squash, rotate, outline or rearrange them, or swap the two colours.
- Retype the wordmark. It is outlined lettering, not a font setting: Exo 2 Black (SIL Open Font License), tightened 6 units, with custom blades.
- Put the bright logo on white; use the deep tones.
- Put any mark on a busy photograph without a dark scrim behind it.
- Change the seal's wording, or use the seal as the main logo.
- Bring back the earlier marks: the gold Road S, the gold "ELITE AUTO DEALER" ring, the car-roof swoosh, or the speed lines inside the C.

## Type around the marks

The site sets everything in **Archivo** (SIL Open Font License): headlines heavy and slightly wide, body text at normal width. Use the same in documents and signage. Exo 2 belongs to the logo only.

## Trademark

The name SABICARS and the logo, filed in black so that every colour is covered, go to the Nigerian Trademarks, Patents and Designs Registry: Class 35 first, then further classes as the ecosystem grows. Run the clearance search before large print runs or signage.
