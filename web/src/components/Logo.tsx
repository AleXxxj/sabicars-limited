import Link from "next/link";
import { MARK, WORDMARK } from "@/components/brand/marks";

/**
 * The SabiCars logo, drawn inline from the brand masters (scripts/build-brand.mjs):
 * sharp at any size, no image request. "Sabi" in Sabi Green, "Cars" in Sabi
 * Orange, each with its blade drawn as its own path. See brand/README.md.
 */
export function Logo({ href = "/", className = "h-7 md:h-8" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Sabicars — home">
      <Wordmark className={`w-auto ${className}`} />
    </Link>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} className={className} aria-hidden focusable="false">
      <path d={WORDMARK.sabi} className="fill-green-500" />
      <path d={WORDMARK.sabiBlade} className="fill-green-500" />
      <path d={WORDMARK.cars} className="fill-orange-500" />
      <path d={WORDMARK.carsBlade} className="fill-orange-500" />
    </svg>
  );
}

/** The mark alone — the S and its blade — for avatars and small places. */
export function Mark({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox={`0 0 ${MARK.width} ${MARK.height}`}
      className={className}
      width={size}
      height={size ? (size * MARK.height) / MARK.width : undefined}
      aria-hidden
      focusable="false"
    >
      <path d={MARK.s} className="fill-green-500" />
      <path d={MARK.blade} className="fill-orange-500" />
    </svg>
  );
}
