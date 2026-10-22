"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader, deliveredByVercel, masterSource } from "@/lib/media";

/**
 * next/image for vehicle photos, resized by Cloudinary or by Vercel
 * depending on NEXT_PUBLIC_IMAGE_DELIVERY (lib/media.ts explains the two).
 *
 * A client component because a loader is a function, and a Server Component
 * cannot pass a function to a Client Component (next/image is one). Pages hand
 * this plain data; the choice of loader stays on this side of the boundary.
 */
export function VehicleImage({ alt, src, ...props }: Omit<ImageProps, "loader">) {
  const isCloudinary = typeof src === "string" && src.includes("res.cloudinary.com");
  if (!isCloudinary) return <Image alt={alt} src={src} {...props} />;
  if (deliveredByVercel()) return <Image alt={alt} src={masterSource(src as string)} {...props} />;
  return <Image alt={alt} src={src} {...props} loader={cloudinaryLoader} />;
}
