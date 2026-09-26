"use client";

import { useReducedMotion, useScrollProgress } from "./motion";

const STATIONS: { title: string; minutes: [number, number]; checks: string[] }[] = [
  {
    title: "The front",
    minutes: [0, 2],
    checks: [
      "Stand back: does it sit level?",
      "Gaps round the bonnet and headlamps should be even.",
      "New headlamps on an old car can mean a front-end knock.",
    ],
  },
  {
    title: "The driver’s side",
    minutes: [2, 5],
    checks: [
      "Look along the panels in daylight for ripples.",
      "Paint that doesn’t quite match means a repair.",
      "Uneven tyre wear points to alignment or suspension trouble.",
    ],
  },
  {
    title: "The rear",
    minutes: [5, 8],
    checks: [
      "Lift the boot floor: rust, water marks or silt are warnings.",
      "Start the engine and watch the exhaust — blue or thick white smoke is trouble.",
    ],
  },
  {
    title: "The passenger side",
    minutes: [8, 10],
    checks: ["The same checks as the driver’s side.", "Press each corner down: it should settle at once, not keep bouncing."],
  },
  {
    title: "Under the bonnet",
    minutes: [10, 13],
    checks: [
      "Oil: not black sludge, not milky.",
      "No leaks — and no suspiciously fresh wash.",
      "Find the chassis number. It must match the papers.",
    ],
  },
  {
    title: "Inside",
    minutes: [13, 16],
    checks: [
      "Warning lights come on with the key and go off with the engine.",
      "Try the AC, windows, locks and every switch.",
      "Smell the carpet: damp or mould means water.",
    ],
  },
  {
    title: "The test drive",
    minutes: [16, 20],
    checks: [
      "Drive it cold, on a rough road and a straight one.",
      "It should pull straight and brake straight.",
      "Gears change cleanly; nothing clunks over bumps.",
    ],
  },
];

const CX = 200;
const CY = 240;
const RX = 122;
const RY = 182;
const SEAT = { x: 177, y: 255 };

/** Where the walker is for a given point in the story (0–7). */
function walker(p: number): { x: number; y: number } {
  if (p <= 4.5) {
    const t = Math.min(Math.max(p, 0.5), 4.5) - 0.5;
    const a = ((-90 - t * 90) * Math.PI) / 180;
    return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
  }
  const k = Math.min(1, p - 4.5);
  const front = { x: CX, y: CY - RY };
  return { x: front.x + (SEAT.x - front.x) * k, y: front.y + (SEAT.y - front.y) * k };
}

/**
 * The twenty-minute inspection, walked. The scene pins while the reader
 * scrolls; a gold dot walks round the car — front, driver's side, rear,
 * passenger side — then the bonnet lights up, the roof fades to show the dot
 * taking the driver's seat, and finally the road starts to move.
 */
export function Walkaround() {
  const reduced = useReducedMotion();
  const [outer, progress] = useScrollProgress<HTMLDivElement>();
  const p = reduced ? 0 : Math.min(6.999, progress * 7.3);
  const i = Math.floor(p);
  const s = STATIONS[i];
  const dot = walker(p);
  const walked = Math.min(1, Math.max(0, (p - 0.5) / 4));
  const glow = (on: boolean) => ({ opacity: on ? 1 : 0, transition: "opacity 500ms ease" });

  if (reduced) {
    return (
      <div className="surface-card p-6 md:p-8">
        <ol className="grid gap-5 md:grid-cols-2">
          {STATIONS.map((st, n) => (
            <li key={st.title}>
              <p className="font-semibold text-text-primary">
                {n + 1}. {st.title}{" "}
                <span className="figures text-xs font-normal text-text-muted">
                  · minutes {st.minutes[0]}–{st.minutes[1]}
                </span>
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-text-secondary">
                {st.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div ref={outer} className="relative" style={{ height: `${STATIONS.length * 55 + 40}svh` }}>
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center md:top-[4.5rem] md:h-[calc(100svh-4.5rem)]">
        <div className="surface-card grid items-center gap-4 overflow-hidden p-4 sm:p-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-8 md:p-8">
          <svg viewBox="30 40 340 400" aria-hidden className="mx-auto max-h-[38svh] w-full md:max-h-[62svh]">
            <defs>
              <radialGradient id="walk-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="rgb(223 198 124 / 0.9)" />
                <stop offset="1" stopColor="rgb(223 198 124 / 0)" />
              </radialGradient>
              <linearGradient id="walk-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2b2824" />
                <stop offset="1" stopColor="#1c1a17" />
              </linearGradient>
            </defs>

            {/* The road, moving under the car on the test drive. */}
            <g style={glow(i === 6)}>
              {[70, 330].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1="40"
                  x2={x}
                  y2="440"
                  stroke="rgb(255 255 255 / 0.35)"
                  strokeWidth="3"
                  strokeDasharray="22 18"
                  className="animate-[road-rush_700ms_linear_infinite]"
                />
              ))}
            </g>

            {/* The walk round the car, and how much of it is done. */}
            <path
              d={`M${CX} ${CY - RY} A${RX} ${RY} 0 1 0 ${CX} ${CY + RY} A${RX} ${RY} 0 1 0 ${CX} ${CY - RY}`}
              fill="none"
              stroke="rgb(255 255 255 / 0.1)"
              strokeWidth="1.5"
              strokeDasharray="3 7"
              style={glow(i < 6)}
            />
            <path
              d={`M${CX} ${CY - RY} A${RX} ${RY} 0 1 0 ${CX} ${CY + RY} A${RX} ${RY} 0 1 0 ${CX} ${CY - RY}`}
              fill="none"
              stroke="var(--gold-400)"
              strokeWidth="2"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - walked}
              style={{ ...glow(i < 6), transition: "opacity 500ms ease" }}
            />

            {/* The car, from above, pointing up the page. */}
            <g className={i === 6 ? "animate-[car-idle_900ms_ease-in-out_infinite]" : undefined}>
              {[
                [126, 150],
                [262, 150],
                [126, 298],
                [262, 298],
              ].map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="12" height="38" rx="4" fill="#0d0c0b" stroke="rgb(255 255 255 / 0.15)" />
              ))}
              <path
                d="M160 118 Q200 108 240 118 Q262 126 264 160 L266 330 Q264 360 240 366 Q200 372 160 366 Q136 360 134 330 L136 160 Q138 126 160 118 Z"
                fill="url(#walk-body)"
                stroke="var(--gold-400)"
                strokeWidth="2"
              />
              {/* Sides and ends that light up as the walker reaches them. */}
              <path d="M134 330 L136 160" stroke="var(--gold-200)" strokeWidth="4" strokeLinecap="round" style={glow(i === 1)} />
              <path d="M266 330 L264 160" stroke="var(--gold-200)" strokeWidth="4" strokeLinecap="round" style={glow(i === 3)} />
              <path
                d="M160 118 Q200 108 240 118"
                fill="none"
                stroke="var(--gold-200)"
                strokeWidth="4"
                strokeLinecap="round"
                style={glow(i === 0)}
              />
              <path
                d="M160 366 Q200 372 240 366"
                fill="none"
                stroke="var(--gold-200)"
                strokeWidth="4"
                strokeLinecap="round"
                style={glow(i === 2)}
              />
              {/* Bonnet. */}
              <path
                d="M142 150 Q146 126 162 122 Q200 114 238 122 Q254 126 258 150 L256 192 L144 192 Z"
                fill="rgb(223 198 124 / 0.22)"
                stroke="var(--gold-300)"
                strokeWidth="1.5"
                style={glow(i === 4)}
              />
              <g style={glow(i === 4)}>
                <rect x="176" y="140" width="48" height="30" rx="4" fill="none" stroke="var(--gold-200)" strokeWidth="1.5" />
                <circle cx="166" cy="178" r="4" fill="var(--gold-200)" />
                <circle cx="234" cy="178" r="4" fill="var(--gold-200)" />
              </g>
              {/* Headlamps and tail lamps. */}
              <g fill="#fffbe8" style={{ opacity: i === 0 || i === 6 ? 1 : 0.35, transition: "opacity 500ms ease" }}>
                <rect x="146" y="124" width="22" height="7" rx="3" />
                <rect x="232" y="124" width="22" height="7" rx="3" />
              </g>
              <g fill="#ff6b5b" style={{ opacity: i === 2 ? 1 : 0.35, transition: "opacity 500ms ease" }}>
                <rect x="146" y="355" width="22" height="6" rx="3" />
                <rect x="232" y="355" width="22" height="6" rx="3" />
              </g>
              {/* Exhaust, at the rear check. */}
              <g style={glow(i === 2)}>
                <circle
                  cx="236"
                  cy="384"
                  r="7"
                  fill="rgb(255 255 255 / 0.12)"
                  className="animate-[smoke_1.6s_ease-out_infinite]"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle
                  cx="240"
                  cy="392"
                  r="10"
                  fill="rgb(255 255 255 / 0.08)"
                  className="animate-[smoke_1.6s_ease-out_0.5s_infinite]"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              </g>
              {/* Glass, and the roof that fades to show the cabin. */}
              <path d="M150 196 L250 196 L242 226 L158 226 Z" fill="rgb(160 190 220 / 0.14)" stroke="rgb(255 255 255 / 0.2)" />
              <path d="M158 314 L242 314 L250 340 L150 340 Z" fill="rgb(160 190 220 / 0.12)" stroke="rgb(255 255 255 / 0.2)" />
              <g style={glow(i >= 5)}>
                <rect x="160" y="238" width="34" height="32" rx="7" fill="#3a352e" stroke="var(--gold-300)" />
                <rect x="206" y="238" width="34" height="32" rx="7" fill="#3a352e" stroke="var(--gold-300)" />
                <rect x="160" y="280" width="80" height="26" rx="7" fill="#3a352e" stroke="var(--gold-300)" />
                <circle cx="177" cy="230" r="9" fill="none" stroke="var(--gold-300)" strokeWidth="2" />
              </g>
              <rect
                x="156"
                y="228"
                width="88"
                height="84"
                rx="10"
                fill="#24211d"
                stroke="rgb(255 255 255 / 0.12)"
                style={{ opacity: i >= 5 ? 0.12 : 1, transition: "opacity 600ms ease" }}
              />
              {/* Mirrors. */}
              <path
                d="M136 200 L124 196 L124 208 L136 210 Z M264 200 L276 196 L276 208 L264 210 Z"
                fill="#2b2824"
                stroke="var(--gold-400)"
                strokeWidth="1"
              />
            </g>

            {/* The walker. */}
            <g transform={`translate(${dot.x} ${dot.y})`}>
              <circle r="22" fill="url(#walk-glow)" />
              <circle r="8" fill="var(--gold-300)" stroke="#0A0908" strokeWidth="2.5" />
            </g>
          </svg>

          <div aria-live="polite" className="min-h-[14rem]">
            <div className="flex items-center justify-between gap-3">
              <p className="figures text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
                Stop {i + 1} of {STATIONS.length}
              </p>
              <p className="figures rounded-full border border-white/12 px-3 py-1 text-xs text-text-secondary">
                ⏱ minutes {s.minutes[0]}–{s.minutes[1]}
              </p>
            </div>
            <div key={i} className="animate-[prompt-in_var(--duration-base)_var(--ease-out)]">
              <p className="mt-3 font-display text-[1.9rem] leading-tight text-text-primary md:text-[2.3rem]">{s.title}</p>
              <ul className="mt-3 grid gap-2">
                {s.checks.map((c) => (
                  <li key={c} className="flex gap-2.5 text-[0.98rem] leading-snug text-text-secondary">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-400" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full rounded-full bg-gold-400"
                style={{ width: `${Math.min(100, ((s.minutes[0] + (s.minutes[1] - s.minutes[0]) * (p - i)) / 20) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <ol className="sr-only">
        {STATIONS.map((st) => (
          <li key={st.title}>
            {st.title}: {st.checks.join(" ")}
          </li>
        ))}
      </ol>
    </div>
  );
}
