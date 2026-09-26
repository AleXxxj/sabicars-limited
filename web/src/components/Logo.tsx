import Link from "next/link";
import { LOGO } from "@/components/brand/marks";

/**
 * The Sabicars logo — the Road S and the wordmark — drawn inline from the brand
 * masters (scripts/build-brand.mjs): sharp at any size, no image request, and
 * the wordmark follows the theme's text colour. See brand/README.md.
 */
export function Logo({ href = "/", className = "h-8 md:h-9" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Sabicars — home">
      <svg viewBox={`0 0 ${LOGO.width} ${LOGO.height}`} className={`w-auto ${className}`} aria-hidden focusable="false">
        <path d={LOGO.s} className="fill-gold-500" />
        <path d={LOGO.wordmark} className="fill-text-primary" />
      </svg>
    </Link>
  );
}
