"use client";

import { useEffect, useRef } from "react";

/**
 * Lets a block rise into place the first time it scrolls into view.
 *
 * Safe by construction: the server renders it visible, and it is only hidden
 * (then revealed) by the browser, for blocks that are still below the fold.
 * So without JavaScript nothing is ever invisible, and nothing already on
 * screen flickers. Reduced-motion settings are respected.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** "li" inside a list: a <div> there is invalid HTML and breaks the list for screen readers. */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.dataset.reveal = "";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.reveal = "in";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = delay ? ({ ["--reveal-delay" as string]: `${delay}ms` } as React.CSSProperties) : undefined;
  return Tag === "li" ? (
    <li ref={ref as React.Ref<HTMLLIElement>} className={className} style={style}>
      {children}
    </li>
  ) : (
    <div ref={ref as React.Ref<HTMLDivElement>} className={className} style={style}>
      {children}
    </div>
  );
}
