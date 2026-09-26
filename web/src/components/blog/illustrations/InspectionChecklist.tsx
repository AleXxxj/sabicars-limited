"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useInView } from "./motion";

const GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Body",
    items: [
      "Walk round in daylight: panel gaps even, paint the same shade on every panel",
      "Underneath with a torch: no rust, patched welds or fresh underseal on the floor and sills",
      "Sliding door glides and latches first time",
    ],
  },
  {
    title: "Engine and drive",
    items: [
      "Start it cold: no heavy smoke, no knocking, no warning lights left on",
      "Under the front seats: no oil leaks, no suspiciously fresh wash",
      "Gears change cleanly; the clutch bites in the middle, not at the top",
      "Drive it loaded if you can: no pulling, no clunks over bumps",
    ],
  },
  {
    title: "Papers",
    items: [
      "Chassis number on the bus matches every document",
      "Customs papers (foreign-used) or the registration history (Nigerian-used) in the seller's name",
      "Seats fitted match the seats on the papers",
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);
/** Where each group's items start in the overall order, for the staggered entrance. */
const OFFSETS = GROUPS.map((_, gi) => GROUPS.slice(0, gi).reduce((n, g) => n + g.items.length, 0));
const KEY = "sabicars:hummer-checklist";

/**
 * The inspection, as a list the reader ticks off — at home while reading, or
 * standing next to the bus. Ticks are kept on the phone, so the list is still
 * half-done when they arrive at the showroom.
 */
export function InspectionChecklist() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setDone(new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]));
      } catch {}
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const toggle = (item: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });

  const count = done.size;
  const circumference = 2 * Math.PI * 26;

  return (
    <div ref={ref} className="surface-card p-6 md:p-8">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--gold-400)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - count / TOTAL)}
            style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div>
          <p className="figures font-display text-[1.9rem] leading-none text-text-primary">
            {count} <span className="text-text-muted">of {TOTAL}</span>
          </p>
          <p className="mt-1 text-sm text-text-secondary" role="status">
            {count === TOTAL
              ? "Checked like a professional. Now book the viewing."
              : "Tap each one as you check it — it stays ticked on this phone."}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
        {GROUPS.map((g, gi) => (
          <fieldset key={g.title}>
            <legend className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">{g.title}</legend>
            <ul className="mt-3 grid gap-2">
              {g.items.map((item, ii) => {
                const i = OFFSETS[gi] + ii;
                const on = done.has(item);
                return (
                  <li
                    key={item}
                    style={{
                      opacity: seen ? 1 : 0,
                      transform: seen ? "none" : "translateY(12px)",
                      transition: `opacity 500ms ease ${i * 90}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms`,
                    }}
                  >
                    <label
                      className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm leading-snug transition-colors ${on ? "border-gold-500/40 bg-gold-500/[0.08] text-text-primary" : "border-white/[0.07] text-text-secondary hover:border-white/20"}`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(item)} className="peer sr-only" />
                      <span
                        aria-hidden
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)] ${on ? "border-gold-400 bg-gold-400 text-[#0A0908]" : "border-white/25"}`}
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      {item}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
