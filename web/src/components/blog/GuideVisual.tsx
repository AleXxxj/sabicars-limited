"use client";

import { useEffect, useRef } from "react";
import { GUIDE_VISUAL_PARTS, type GuideVisualKind } from "@/lib/guide-visual";

/**
 * The small moving picture on an article's card (lib/guide-visual.ts chooses it, styles/guide-visual.css draws it).
 * It plays the first time the card is well in view, which is how a phone sees it, and again whenever the card is
 * pointed at or focused. Decoration only: hidden from screen readers, and still for anyone who asks for less motion.
 */
export function GuideVisual({ kind, small = false }: { kind: GuideVisualKind; small?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let rest: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        el.dataset.live = "";
        // Once it has played (twice through, as the CSS says), it rests, so pointing at the card plays it again.
        rest = window.setTimeout(() => delete el.dataset.live, 6000);
      },
      { threshold: 0.9 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(rest);
    };
  }, []);

  return (
    <span ref={ref} aria-hidden="true" className={`gv gv--${kind}${small ? " gv--small" : ""}`}>
      {Array.from({ length: GUIDE_VISUAL_PARTS[kind] }, (_, i) => (
        <i key={i} style={{ ["--i" as string]: i }} />
      ))}
      {(kind === "road" || kind === "plan" || kind === "budget") && <b />}
    </span>
  );
}
