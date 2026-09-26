"use client";

import { useMemo, useState } from "react";
import { useReducedMotion, useScrollProgress } from "./motion";

type Who = "You" | "Autochek" | "Sabicars";

const STEPS: { title: string; text: string; who: Who[] }[] = [
  {
    title: "Choose the car",
    text: "Pick it in the showroom. See it, inspect it, drive it — bring your own mechanic if you like.",
    who: ["You", "Sabicars"],
  },
  {
    title: "Apply on Autochek",
    text: "From the car’s page you go straight to its listing on Autochek, Sabicars’ financing partner. The loan terms are set there.",
    who: ["You", "Autochek"],
  },
  {
    title: "Autochek profiles you",
    text: "Autochek checks who you are and what you earn. Its application tells you exactly what it needs.",
    who: ["Autochek"],
  },
  { title: "Autochek approves", text: "The 60% is approved. Until this point the car stays in the showroom.", who: ["Autochek"] },
  { title: "Pay your 40%", text: "You pay Sabicars your 40% deposit, and the paperwork is completed.", who: ["You", "Sabicars"] },
  {
    title: "Drive it home",
    text: "The car leaves the showroom with you. You repay Autochek monthly, on the terms you agreed.",
    who: ["You"],
  },
];

const WHO_TONE: Record<Who, string> = {
  You: "bg-gold-400 text-[#0A0908]",
  Autochek: "border border-white/25 text-text-primary",
  Sabicars: "border border-gold-500/50 text-gold-200",
};

/** The road the car travels, winding up the scene. */
const ROAD = "M40 392 C170 392 190 318 300 318 S470 396 548 316 S520 188 392 190 S150 196 168 110 S360 36 560 44";

/**
 * The Drive Plan as a journey. The scene pins to the screen and the car
 * drives the road as the reader scrolls, passing six milestones — so the
 * order of things (and that the car only leaves after Autochek approves) is
 * something the reader sees happen, not a list they skim.
 */
export function DrivePlanJourney() {
  const reduced = useReducedMotion();
  const [outer, progress] = useScrollProgress<HTMLDivElement>();
  // The drawn road, kept once it exists, so positions along it can be measured.
  const [road, setRoad] = useState<SVGPathElement | null>(null);
  const len = useMemo(() => road?.getTotalLength() ?? 0, [road]);

  const p = reduced ? 1 : Math.min(1, progress * 1.08);
  const active = reduced ? STEPS.length - 1 : Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
  const stops = STEPS.map((_, i) => 0.03 + (i / (STEPS.length - 1)) * 0.94);
  const at = (t: number) => (road && len ? road.getPointAtLength(t * len) : { x: 40, y: 392 });
  const car = at(Math.min(p, 0.999));
  const ahead = at(Math.min(p + 0.01, 1));
  const angle = (Math.atan2(ahead.y - car.y, ahead.x - car.x) * 180) / Math.PI;
  const step = STEPS[active];

  return (
    <div ref={outer} className="relative" style={{ height: reduced ? undefined : `${STEPS.length * 60 + 40}svh` }}>
      <div
        className={
          reduced ? "" : "sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center md:top-[4.5rem] md:h-[calc(100svh-4.5rem)]"
        }
      >
        <div className="surface-card grid items-center gap-6 overflow-hidden p-4 sm:p-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:p-8">
          <svg viewBox="0 0 600 430" aria-hidden className="w-full">
            <defs>
              <radialGradient id="journey-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="rgb(223 198 124 / 0.55)" />
                <stop offset="1" stopColor="rgb(223 198 124 / 0)" />
              </radialGradient>
            </defs>
            {/* The road: asphalt, its edges, and the centre line. */}
            <path ref={setRoad} d={ROAD} fill="none" stroke="#24211d" strokeWidth="38" strokeLinecap="round" />
            <path
              d={ROAD}
              fill="none"
              stroke="rgb(255 255 255 / 0.07)"
              strokeWidth="40"
              strokeLinecap="round"
              style={{ mixBlendMode: "screen" }}
            />
            <path d={ROAD} fill="none" stroke="#1a1815" strokeWidth="34" strokeLinecap="round" />
            <path d={ROAD} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1.5" strokeDasharray="10 12" />
            {/* The distance covered, in gold. */}
            {len > 0 && (
              <path
                d={ROAD}
                fill="none"
                stroke="var(--gold-400)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - p)}
                style={{ filter: "drop-shadow(0 0 6px rgb(201 168 76 / 0.7))" }}
              />
            )}
            {/* Milestones. */}
            {len > 0 &&
              stops.map((t, i) => {
                const pt = at(t);
                const passed = i < active || (i === active && p >= t - 0.01);
                return (
                  <g key={i} transform={`translate(${pt.x} ${pt.y})`}>
                    {i === active && <circle r="26" fill="url(#journey-glow)" className="animate-pulse" />}
                    <circle r="14" fill={passed ? "var(--gold-400)" : "#0A0908"} stroke="var(--gold-400)" strokeWidth="2" />
                    <text
                      y="5"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill={passed ? "#0A0908" : "var(--gold-300)"}
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            {/* The car, seen from above, turning with the road. */}
            {len > 0 && (
              <g transform={`translate(${car.x} ${car.y}) rotate(${angle})`}>
                <ellipse rx="26" ry="15" fill="rgb(0 0 0 / 0.45)" transform="translate(2 4)" />
                <rect x="-22" y="-12" width="44" height="24" rx="9" fill="var(--gold-300)" />
                <rect x="-3" y="-10" width="15" height="20" rx="4" fill="#0A0908" opacity="0.8" />
                <rect x="-17" y="-9" width="9" height="18" rx="3" fill="#0A0908" opacity="0.55" />
                <circle cx="21" cy="-7" r="2" fill="#fffbe8" />
                <circle cx="21" cy="7" r="2" fill="#fffbe8" />
              </g>
            )}
          </svg>

          {reduced ? (
            <ol className="grid gap-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="figures grid size-7 shrink-0 place-items-center rounded-full bg-gold-400 text-xs font-bold text-[#0A0908]">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-text-primary">{s.title}</span>
                    <span className="block text-sm text-text-secondary">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div aria-live="polite" className="min-h-[13rem] md:min-h-0">
              <p className="figures text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
                Step {active + 1} of {STEPS.length}
              </p>
              <div key={active} className="animate-[prompt-in_var(--duration-base)_var(--ease-out)]">
                <p className="mt-3 font-display text-[2rem] leading-tight text-text-primary md:text-[2.4rem]">{step.title}</p>
                <p className="mt-3 text-[1.02rem] leading-relaxed text-text-secondary">{step.text}</p>
                <p className="mt-4 flex flex-wrap gap-2">
                  {step.who.map((w) => (
                    <span key={w} className={`rounded-full px-3 py-1 text-xs font-semibold ${WHO_TONE[w]}`}>
                      {w}
                    </span>
                  ))}
                </p>
              </div>
              <div className="mt-6 flex gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= active ? "bg-gold-400" : "bg-white/10"}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {!reduced && active === 0 && progress < 0.02 && (
          <p className="mt-3 text-center text-xs text-text-muted">Scroll to drive the journey</p>
        )}
      </div>
      {/* The whole journey in one list, for screen readers and for anyone who prefers still pages. */}
      <ol className="sr-only">
        {STEPS.map((s) => (
          <li key={s.title}>
            {s.title}: {s.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
