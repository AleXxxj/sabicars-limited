"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Next's Link, but a page is fetched ahead only when a visitor shows they are about to open it: the mouse over the
 * link, or the keyboard on it. Every link on the site uses this one (imported as `Link`).
 *
 * Next fetches every page whose link scrolls into view, in case it is tapped. Measured on 14 November 2026: scrolling the
 * homepage once on a phone fetched 25 other pages, about 605 KB, before anything was tapped. Most visitors are on paid
 * mobile data, often weak, and that traffic competed with the page being opened (the owner's phone, the same evening:
 * "glitching, then stuck in loading").
 *
 * Not a finger: every swipe on a phone starts with a touch on whatever is under the thumb, and on the cars page the cards
 * fill the screen, so fetching on touch still cost about 220 KB per scroll of /vehicles (review, the same night). On a
 * phone a page is fetched when it is tapped. A focus counts only when it is the keyboard's (:focus-visible): a tap
 * focuses a link too, a moment before it opens it.
 *
 * An explicit `prefetch` is kept as given.
 */
export default function IntentLink({ prefetch, onPointerEnter, onFocus, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  if (prefetch !== undefined) {
    return <NextLink {...props} prefetch={prefetch} onPointerEnter={onPointerEnter} onFocus={onFocus} />;
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
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        if (e.pointerType === "mouse") warm();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        let keyboard = true;
        try {
          keyboard = e.currentTarget.matches(":focus-visible");
        } catch {
          /* An older browser: treat any focus as the keyboard's. */
        }
        if (keyboard) warm();
      }}
    />
  );
}
