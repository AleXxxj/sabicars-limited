"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { recordView } from "@/lib/actions/blog";

/** A thin gold line across the top of the screen that fills as the article is read. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div
        ref={bar}
        className="h-full origin-left scale-x-0 bg-[linear-gradient(90deg,var(--gold-500),var(--gold-200))] shadow-[0_0_12px_rgb(201_168_76/0.6)]"
      />
    </div>
  );
}

export interface Heading {
  id: string;
  text: string;
}

/** The section being read: the last heading that has passed the reading line, a third of the way down the screen. */
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let now: string | null = null;
      for (const e of els) if (e.getBoundingClientRect().top <= line) now = e.id;
      setCurrent(now);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [key]);
  return current;
}

/**
 * The article's sections. On a wide screen it stays beside the text and marks
 * where the reader is; on a phone it is a compact "In this article" that opens.
 */
export function Contents({ headings, variant }: { headings: Heading[]; variant: "rail" | "inline" }) {
  const current = useCurrentSection(headings.map((h) => h.id));
  const [open, setOpen] = useState(false);
  if (headings.length < 3) return null;

  const list = (
    <ol className="grid gap-1">
      {headings.map((h, i) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            onClick={() => setOpen(false)}
            aria-current={current === h.id ? "true" : undefined}
            className={`flex gap-3 rounded-lg px-3 py-2 text-sm leading-snug transition-colors ${
              current === h.id ? "bg-gold-500/10 text-text-primary" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <span className="figures shrink-0 text-gold-300/80">{String(i + 1).padStart(2, "0")}</span>
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "rail") {
    return (
      <nav aria-label="In this article" className="sticky top-28">
        <p className="mb-3 px-3 text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">In this article</p>
        {list}
      </nav>
    );
  }
  return (
    <nav aria-label="In this article" className="surface-card overflow-hidden !rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 text-left"
      >
        <span className="text-sm font-semibold text-text-primary">
          In this article <span className="font-normal text-text-muted">· {headings.length} sections</span>
        </span>
        <ChevronDown
          aria-hidden
          size={18}
          className={`text-gold-300 transition-transform duration-[var(--duration-base)] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-white/[0.06] p-2">{list}</div>}
    </nav>
  );
}

/** Counts the read once per visit, after the reader has stayed long enough to be reading. */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `sabicars:read:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
      void recordView(slug);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [slug]);
  return null;
}
