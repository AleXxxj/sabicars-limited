"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Next's Link, but a page is fetched ahead only when the visitor shows they are about to open it: a finger on the link,
 * the mouse over it, or the keyboard on it. Every link on the site uses this one (imported as `Link`).
 *
 * Next fetches every page whose link scrolls into view, in case it is tapped. Measured on 14 November 2026: scrolling the
 * homepage once on a phone fetched 25 other pages, about 605 KB, before anything was tapped. Most visitors are on paid
 * mobile data, often weak, and that traffic competed with the page being opened (the owner's phone, the same evening:
 * "glitching, then stuck in loading"). A touch comes a moment before the tap, so the page still opens quickly.
 *
 * An explicit `prefetch` is kept as given.
 */
export default function IntentLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  if (prefetch !== undefined) {
    return <NextLink {...props} prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} />;
  }
  // Only the site's own pages: an outside or protocol link (tel:, mailto:) has nothing to fetch ahead.
  const href = typeof props.href === "string" && props.href.startsWith("/") && !props.href.startsWith("//") ? props.href : null;
  const warm = () => {
    if (href) router.prefetch(href);
  };
  return (
    <NextLink
      {...props}
      prefetch={false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        warm();
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        warm();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        warm();
      }}
    />
  );
}
