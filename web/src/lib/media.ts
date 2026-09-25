import type { ImageLoaderProps } from "next/image";

/**
 * Resizing is done by Cloudinary, not by Vercel.
 *
 * Every vehicle photo already lives on Cloudinary, which can resize, crop and
 * convert to WebP/AVIF at its edge. Using it as next/image's loader means a
 * phone on a 3G connection in Ibadan downloads a 400px WebP instead of the
 * 2,000px JPEG the salesperson uploaded — and Vercel's metered image
 * optimisation is never touched.
 *
 * f_auto picks the best format the browser accepts; q_auto picks the lowest
 * quality that is visually lossless for that particular image.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  const q = quality ? `q_${quality}` : "q_auto";
  return src.replace("/upload/", `/upload/f_auto,${q},c_limit,w_${width}/`);
}

/**
 * The image a link preview shows — WhatsApp, Facebook, X, iMessage. 1200×630 is
 * the size they all crop to; g_auto lets Cloudinary keep the car in frame
 * rather than centring on the sky. JPEG because some preview crawlers still
 * do not render WebP.
 */
export function shareImageUrl(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
}

/** Shown when a vehicle has no photos yet. An honest empty state, never a stock car. */
export const VEHICLE_PLACEHOLDER = "/vehicle-placeholder.svg";
