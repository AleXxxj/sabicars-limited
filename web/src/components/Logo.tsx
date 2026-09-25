import Image from "next/image";
import Link from "next/link";

/**
 * The monogram with the name set in the label voice beside it.
 *
 * The mark currently exists only as a 160px raster with its black ground baked
 * in (extracted from the legacy site). It is sharp at header size; the vector
 * original is an open item in docs/ARCHITECTURE.md §8.
 */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3" aria-label="Sabicars — home">
      <Image src="/logo-mark.png" alt="" width={40} height={40} className="rounded-[4px]" priority />
      <span className="font-sans text-[0.95rem] font-semibold uppercase tracking-[0.32em] text-text-primary [font-stretch:125%]">
        Sabicars
      </span>
    </Link>
  );
}
