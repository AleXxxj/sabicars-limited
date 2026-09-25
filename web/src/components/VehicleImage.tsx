"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryLoader } from "@/lib/media";

/**
 * next/image with Cloudinary doing the resizing.
 *
 * A client component because a loader is a function, and a Server Component
 * cannot pass a function to a Client Component (next/image is one). Pages hand
 * this plain data; the loader stays on this side of the boundary.
 */
export function VehicleImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  const isCloudinary = typeof props.src === "string" && props.src.includes("res.cloudinary.com");
  return <Image alt={alt} {...props} loader={isCloudinary ? cloudinaryLoader : undefined} />;
}
