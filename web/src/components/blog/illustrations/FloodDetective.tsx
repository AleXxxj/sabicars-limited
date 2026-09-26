"use client";

import { useEffect, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { useInView, useReducedMotion } from "./motion";

const CLUES = [
  {
    x: 724,
    y: 229,
    title: "Inside the headlamps",
    text: "Mist or a tide mark inside the lamps. They are sealed: water inside came up from below.",
  },
  {
    x: 498,
    y: 284,
    title: "Seat rails and bolts",
    text: "Rust on the seat rails and their bolts. They sit under the carpet, where nothing ordinary makes them rust.",
  },
  {
    x: 392,
    y: 272,
    title: "Under the carpet",
    text: "Silt or dried mud under the carpet — or a brand-new carpet in an old car. Lift a corner and look.",
  },
  {
    x: 118,
    y: 258,
    title: "The spare-wheel well",
    text: "Water marks, silt or rust in the spare-wheel well. Floodwater settles there and stays.",
  },
  {
    x: 592,
    y: 246,
    title: "Wiring under the dashboard",
    text: "Green or white crust on the wiring plugs. Electrical faults follow a flood for years.",
  },
  { x: 372, y: 166, title: "The smell", text: "A musty smell — or a car drowning in air freshener. Your nose finds what new paint hides." },
];

type Phase = "idle" | "rising" | "draining" | "hunt";

/**
 * "Has it been under water?" — floodwater rises through the car and drains
 * away, leaving only a tide mark. Then the reader hunts for the six places a
 * flood leaves its evidence, each explained as it is found.
 */
export function FloodDetective() {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>(0.45);
  const [phase, setPhase] = useState<Phase>("idle");
  // Each flood is one run of the sequence; "Flood it again" starts another.
  const [run, setRun] = useState(0);
  const [found, setFound] = useState<number[]>([]);
  const [miss, setMiss] = useState<{ x: number; y: number; n: number } | null>(null);
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    if (!seen) return;
    if (reduced) {
      const t = window.setTimeout(() => setPhase("hunt"), 0);
      return () => window.clearTimeout(t);
    }
    const a = window.setTimeout(() => setPhase("rising"), 200);
    const b = window.setTimeout(() => setPhase("draining"), 2600);
    const c = window.setTimeout(() => setPhase("hunt"), 4400);
    return () => [a, b, c].forEach(window.clearTimeout);
  }, [seen, run, reduced]);

  const find = (i: number) => {
    if (phase !== "hunt") return;
    setLast(i);
    setFound((f) => (f.includes(i) ? f : [...f, i]));
  };
  const all = found.length === CLUES.length;
  // High enough to fill the headlamps and reach the dashboard wiring, as a real flood does.
  const waterY = phase === "rising" ? 212 : 400;

  return (
    <div ref={ref} className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {phase === "hunt" ? (
            all ? (
              <span className="text-success">All six found. You would have caught it.</span>
            ) : (
              <>
                The water is gone. The evidence isn&rsquo;t — <span className="text-text-primary">tap where you would look.</span>
              </>
            )
          ) : (
            "Watch the water…"
          )}
        </p>
        <p className="figures rounded-full border border-gold-500/40 px-3 py-1 text-sm font-semibold text-gold-200">
          {found.length} of {CLUES.length} found
        </p>
      </div>

      <svg
        viewBox="40 90 730 250"
        className="mt-4 w-full select-none"
        role="img"
        aria-label="Side view of a car after a flood, with places to check for flood damage"
        onClick={(e) => {
          if (phase !== "hunt") return;
          const svg = e.currentTarget;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const { x, y } = pt.matrixTransform(m.inverse());
          const hit = CLUES.findIndex((c) => Math.hypot(c.x - x, c.y - y) < 42);
          if (hit >= 0) find(hit);
          else setMiss((prev) => ({ x, y, n: (prev?.n ?? 0) + 1 }));
        }}
      >
        <defs>
          <clipPath id="flood-car">
            <path d="M60 280 L70 230 Q80 214 120 208 L230 196 Q270 150 330 130 L500 126 Q560 130 610 190 L700 208 Q740 216 744 250 L748 280 Q748 296 730 298 L60 298 Z" />
          </clipPath>
          <linearGradient id="flood-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(90 170 200 / 0.55)" />
            <stop offset="1" stopColor="rgb(40 90 120 / 0.35)" />
          </linearGradient>
        </defs>

        <line x1="40" y1="334" x2="770" y2="334" stroke="rgb(255 255 255 / 0.1)" />

        {/* The interior, seen through the side of the car. */}
        <g fill="none" stroke="rgb(223 198 124 / 0.45)" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M240 280 L622 280" strokeDasharray="6 6" />
          <path d="M282 278 L292 212 Q296 202 306 204 L318 206 L312 262 L360 262 L360 278" />
          <path d="M470 278 L482 204 Q486 194 496 196 L508 198 L502 260 L546 260 L546 278" />
          <path d="M470 284 L550 284 M282 284 L360 284" stroke="rgb(223 198 124 / 0.7)" strokeWidth="2.5" />
          <path d="M562 204 Q600 198 612 212 L612 232 L566 232 Z" />
          <path d="M572 238 q6 8 12 0 t12 0 t12 0 M572 252 q6 8 12 0 t12 0 t12 0" />
          <circle cx="118" cy="258" r="22" strokeDasharray="4 5" />
          <circle cx="118" cy="258" r="8" />
        </g>

        {/* The floodwater, rising and draining — and the tide mark it leaves. */}
        <g clipPath="url(#flood-car)">
          <rect
            x="40"
            y="0"
            width="740"
            height="200"
            fill="url(#flood-water)"
            style={{
              transform: `translateY(${waterY}px)`,
              transition: `transform ${phase === "rising" ? 2000 : 1600}ms cubic-bezier(0.45,0,0.2,1)`,
            }}
          />
          <path
            d="M40 0 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"
            fill="none"
            stroke="rgb(170 220 240 / 0.6)"
            strokeWidth="2"
            style={{
              transform: `translateY(${waterY}px)`,
              transition: `transform ${phase === "rising" ? 2000 : 1600}ms cubic-bezier(0.45,0,0.2,1)`,
            }}
          />
          <line
            x1="40"
            y1="213"
            x2="780"
            y2="213"
            stroke="rgb(170 120 60 / 0.8)"
            strokeWidth="2"
            strokeDasharray="2 3"
            style={{ opacity: phase === "draining" || phase === "hunt" ? 1 : 0, transition: "opacity 800ms ease 400ms" }}
          />
        </g>

        {/* The car. */}
        <g fill="none" stroke="var(--gold-400)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M60 280 L70 230 Q80 214 120 208 L230 196 Q270 150 330 130 L500 126 Q560 130 610 190 L700 208 Q740 216 744 250 L748 280 Q748 296 730 298 L680 298 A46 46 0 0 0 588 298 L250 298 A46 46 0 0 0 158 298 L80 298 Q60 296 60 280 Z" />
          <path
            d="M252 196 L330 140 L410 138 L410 196 Z M422 138 L498 134 L592 192 L422 196 Z"
            strokeWidth="1.6"
            fill="rgb(160 190 220 / 0.06)"
          />
          <path d="M716 222 L740 226 L742 238 L714 236 Z" strokeWidth="1.6" />
          <circle cx="204" cy="298" r="34" />
          <circle cx="634" cy="298" r="34" />
          <circle cx="204" cy="298" r="13" strokeWidth="1.4" />
          <circle cx="634" cy="298" r="13" strokeWidth="1.4" />
        </g>
        <text
          x="46"
          y="208"
          fontSize="11"
          fill="rgb(200 150 90)"
          style={{ fontFamily: "var(--font-sans)", opacity: phase === "hunt" ? 1 : 0, transition: "opacity 600ms ease" }}
        >
          tide mark
        </text>

        {/* A miss: a ripple where the reader tapped. */}
        {miss && phase === "hunt" && !all && (
          <circle
            key={miss.n}
            cx={miss.x}
            cy={miss.y}
            r="16"
            fill="none"
            stroke="rgb(255 255 255 / 0.5)"
            strokeWidth="2"
            className="animate-[ripple_600ms_ease-out_forwards]"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {/* The clues: invisible until found. Buttons so a keyboard can find them too. */}
        {CLUES.map((c, i) => {
          const on = found.includes(i);
          return (
            <g
              key={c.title}
              role="button"
              tabIndex={phase === "hunt" ? 0 : -1}
              aria-label={on ? c.title : `Hiding place ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                find(i);
              }}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), find(i))}
              style={{ cursor: phase === "hunt" ? "pointer" : "default", outline: "none" }}
            >
              <circle cx={c.x} cy={c.y} r="30" fill="transparent" />
              <g
                style={{
                  opacity: on ? 1 : 0,
                  transform: on ? "scale(1)" : "scale(0.3)",
                  transformOrigin: `${c.x}px ${c.y}px`,
                  transition: "opacity 300ms ease, transform 450ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <circle cx={c.x} cy={c.y} r="24" fill="rgb(223 198 124 / 0.16)" />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="13"
                  fill={last === i ? "var(--gold-200)" : "var(--gold-400)"}
                  stroke="#0A0908"
                  strokeWidth="3"
                />
                <text
                  x={c.x}
                  y={c.y + 4.5}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#0A0908"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {i + 1}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      <div aria-live="polite" className="mt-5 min-h-[5.5rem]">
        {last !== null ? (
          <div
            key={last}
            className="animate-[prompt-in_var(--duration-base)_var(--ease-out)] rounded-xl border border-gold-500/30 bg-gold-500/[0.06] p-4"
          >
            <p className="font-semibold text-text-primary">
              {last + 1}. {CLUES[last].title}
            </p>
            <p className="mt-1 text-[0.98rem] leading-relaxed text-text-secondary">{CLUES[last].text}</p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {phase === "hunt" ? "Hint: think about the places water reaches and nobody cleans." : ""}
          </p>
        )}
      </div>

      {found.length > 0 && (
        <ol className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {CLUES.map((c, i) =>
            found.includes(i) ? (
              <li key={c.title} className="flex gap-2 text-text-secondary">
                <span className="figures text-gold-300">{i + 1}.</span>
                <button type="button" onClick={() => setLast(i)} className="text-left hover:text-text-primary">
                  {c.title}
                </button>
              </li>
            ) : null,
          )}
        </ol>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {phase === "hunt" && !all && (
          <button
            type="button"
            onClick={() => {
              setFound(CLUES.map((_, i) => i));
              setLast(0);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-text-secondary hover:border-white/35 hover:text-text-primary"
          >
            <Eye aria-hidden size={15} /> Show me all six
          </button>
        )}
        {phase === "hunt" && found.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setFound([]);
              setLast(null);
              setMiss(null);
              setPhase("idle");
              setRun((r) => r + 1);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm text-text-muted hover:text-text-primary"
          >
            <RotateCcw aria-hidden size={15} /> Flood it again
          </button>
        )}
      </div>
    </div>
  );
}
