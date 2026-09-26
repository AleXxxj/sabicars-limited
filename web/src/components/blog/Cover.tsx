import { VehicleImage } from "@/components/VehicleImage";

/**
 * An article's cover. Sabicars' own photos come through Cloudinary, resized
 * per device; an old post's cover from elsewhere is shown as it is rather
 * than breaking the page.
 */
export function Cover({
  src,
  sizes,
  priority = false,
  className = "",
}: {
  src: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (src.includes("res.cloudinary.com"))
    return <VehicleImage src={src} alt="" fill priority={priority} sizes={sizes} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- an external cover next/image is not configured for
  return <img src={src} alt="" loading={priority ? "eager" : "lazy"} className={`absolute inset-0 size-full ${className}`} />;
}
