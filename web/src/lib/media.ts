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

/** Shown when a vehicle has no photos yet. An honest empty state, never a stock car. */
export const VEHICLE_PLACEHOLDER = "/vehicle-placeholder.svg";
