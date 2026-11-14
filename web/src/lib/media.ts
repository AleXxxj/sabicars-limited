import type { ImageLoaderProps } from "next/image";

/**
 * Who resizes the photos. Two ways, one switch.
 *
 * Every vehicle photo is stored on Cloudinary. What a visitor's phone
 * receives is a resized copy, and every distinct copy is billed once:
 * Cloudinary counts 1,000 resizes, 1 GB stored or 1 GB delivered as one
 * credit (25 a month on its free plan).
 *
 * "cloudinary" (today): Cloudinary resizes each photo for each screen size
 *   and delivers it. Simple, but every size of every photo is a Cloudinary
 *   resize, and every view of every photo is Cloudinary bandwidth — on a
 *   viral day that is tens of gigabytes, and with 10,000 photos the resizes
 *   alone pass the free plan.
 *
 * "vercel" (NEXT_PUBLIC_IMAGE_DELIVERY=vercel): Cloudinary makes ONE copy of
 *   each photo (the master below: enhanced, at most 1600px, ~250 KB) and
 *   Vercel resizes that copy and keeps every size in its own image cache for
 *   31 days, delivering from its edge. Cloudinary then sees one fetch per
 *   size per month at most, however many people look. Only on Vercel Pro:
 *   the Hobby plan stops resizing new photos after 5,000 a month and shows
 *   their description text instead, so the switch stays off until then.
 *   Takes effect on the next deploy (it is read at build time).
 */
export function deliveredByVercel(): boolean {
  return process.env.NEXT_PUBLIC_IMAGE_DELIVERY === "vercel";
}

/**
 * Sabicars' own Cloudinary account: every photo on the site is stored under
 * it (all 486 photo addresses checked on 7 November 2026). next.config lets
 * Vercel resize photos from this account only, so nobody can use the site to
 * resize other people's pictures on Sabicars' bill.
 */
export const PHOTO_CLOUD = "dbmtqpex2";

/**
 * Whether Vercel may resize this photo. A Cloudinary photo from any other
 * account (a blog cover pasted from elsewhere, say) stays with Cloudinary's
 * own resizing, so it still shows instead of failing the lock above.
 */
export function isOwnPhoto(src: string): boolean {
  return src.startsWith(`https://res.cloudinary.com/${PHOTO_CLOUD}/image/upload/`);
}

/**
 * The one copy Vercel resizes from. e_improve corrects exposure and colour
 * per photo: most stock is shot on a phone in an open car park under a white
 * Lagos sky, and it lifts a dull, flat frame without the over-saturated look
 * of a filter (compared side by side on real listings before choosing it).
 * JPEG, because Vercel converts it to WebP itself; q_auto:good keeps it
 * visually lossless at a fraction of the size.
 */
export function masterSource(src: string): string {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  return src.replace("/upload/", "/upload/e_improve,c_limit,w_1600,h_1600,q_auto:good,f_jpg/");
}

/**
 * Cloudinary as next/image's loader (delivery "cloudinary"): a phone on a 3G
 * connection in Ibadan downloads a 640px WebP instead of the photo the
 * salesperson uploaded. f_auto picks the best format the browser accepts and
 * q_auto the quality per photo (next/image passes no quality to a custom
 * loader unless a component sets one; next.config's qualities apply only
 * when Vercel resizes). The widths are the short list in next.config, so
 * each photo has at most a handful of copies.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  const q = quality ? `q_${quality}` : "q_auto";
  return src.replace("/upload/", `/upload/e_improve,f_auto,${q},c_limit,w_${width}/`);
}

/**
 * The image a link preview shows — WhatsApp, Facebook, X, iMessage. 1200×630 is
 * the size they all crop to; g_auto lets Cloudinary keep the car in frame
 * rather than centring on the sky. JPEG because some preview crawlers still
 * do not render WebP.
 */
export function shareImageUrl(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/e_improve,c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
}

/**
 * The copy a partner posts or saves (/partner/cars): the same lift as every
 * photo on the site, 1280px on the long side, JPEG. Big enough for a WhatsApp
 * status or an Instagram post (both shrink anything larger), small enough that
 * getting a car's photos ready costs a partner's data bundle little. The
 * browser adds the Sabicars strip with the partner's code before it shares or
 * saves it; Cloudinary answers with an open CORS header, so it may.
 */
export function sharePhotoSource(src: string): string {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  return src.replace("/upload/", "/upload/e_improve,c_limit,w_1280,h_1280,q_auto:good,f_jpg/");
}

/**
 * The home hero's photo, framed on the car (components/home/HeroSlides).
 *
 * Most stock is shot upright on a phone: sky in the top of the frame, the
 * car low down. So Cloudinary frames the car itself (g_auto finds it, as it
 * does for link previews above), in two shapes:
 *
 * - `srcSet`, for a phone or a tablet: an upright or square photo becomes a
 *   wide one (1.15 wide to 1 high) with the car whole in the middle, at the
 *   photo's full width, so nothing is enlarged and the car fills its space
 *   (the owner, 14 November 2026). Tried on the owner's seven hero cars that
 *   day, the 9:16 shots among them: every car came out whole. A photo already
 *   that wide is left as it is.
 * - `wide`, for a wide screen, where the photo alone covers the whole hero
 *   the way Adedayo's does (the owner, 14 November 2026, beside Adedayo's
 *   desktop hero): the car framed as above, then the middle strip of it, so
 *   the hero shows the car's face and not the sky above it. Framing the car
 *   first matters: asked for a strip straight away, g_auto chose the Hummer
 *   bus's bumper alone and the Highlander's grille alone; framed first, their
 *   badge, lights and bumper all show. The strip is 1.5 wide to 1 high, the
 *   shape of the narrowest wide-screen hero (1024 by 680): a laptop then shows
 *   as much of the car's height as its hero can hold, about a sixth more than
 *   a 16:9 strip did (the owner asked for the Hummer, the RX 350L and the
 *   G 63 to be more visible, same day), and a wider screen trims the strip's
 *   top and foot just as before.
 *
 * Asked of Cloudinary directly whatever NEXT_PUBLIC_IMAGE_DELIVERY says: the
 * framing is Cloudinary's work, and this is seven photos, not the stock.
 * Null for a photo that is not on Cloudinary; the caller shows it plain.
 */
export function heroPhotoSources(src: string): { srcSet: string; fallback: string; wide: string } | null {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return null;
  const at = (frame: string, width: number) => src.replace("/upload/", `/upload/${frame}e_improve,f_auto,q_auto,c_limit,w_${width}/`);
  const phone = "if_ar_lt_1.15/ar_1.15,c_fill,g_auto/if_end/";
  const wide = `${phone}ar_1.5,c_fill,g_center/`;
  return {
    srcSet: [640, 828, 1080, 1600].map((w) => `${at(phone, w)} ${w}w`).join(", "),
    fallback: at(phone, 828),
    wide: [1280, 1600, 1920].map((w) => `${at(wide, w)} ${w}w`).join(", "),
  };
}

/** Shown when a vehicle has no photos yet. An honest empty state, never a stock car. */
export const VEHICLE_PLACEHOLDER = "/vehicle-placeholder.svg";
