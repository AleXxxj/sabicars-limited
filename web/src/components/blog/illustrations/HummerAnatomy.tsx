"use client";

import { useState } from "react";
import { useInView, useWidth } from "./motion";

const SPOTS = [
  {
    x: 430,
    y: 63,
    title: "The high roof",
    text: "The roof that gives the Hummer its name and its headroom. Check the roof lining inside for water stains: a leaking seal is cheap to fix and expensive to ignore.",
  },
  {
    x: 338,
    y: 244,
    title: "The sliding door",
    text: "On a working bus it is opened thousands of times a month. It should glide, latch first time and not rattle. Worn rollers or a sagging door mean hard use.",
  },
  {
    x: 186,
    y: 246,
    title: "Engine under the front seats",
    text: "The Hiace is a cab-over: the engine sits beneath the front seats. Lift the seat and look for oil leaks — and for an engine washed suspiciously clean.",
  },
  {
    x: 600,
    y: 286,
    title: "Rear springs and axle",
    text: "Leaf springs carry the load. A bus sitting low at the back, cracked leaves, or new U-bolts on an old bus all point to years of overloading.",
  },
  {
    x: 468,
    y: 300,
    title: "Floor and sills",
    text: "Get low with a torch. Rust, patched welds, or thick fresh underseal along the sills and floor are the first questions to ask.",
  },
  {
    x: 84,
    y: 238,
    title: "The front end",
    text: "A new bumper or headlamps that don't match on an older bus can mean a front-end knock. Ask about it, and look for uneven gaps between panels.",
  },
];

/**
 * The Hummer bus, drawn in gold line as it scrolls into view, then labelled:
 * six places to look before you buy one, and why each matters. Tapping a
 * number, or a line in the list, highlights the other.
 */
export function HummerAnatomy() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [box, width] = useWidth<SVGSVGElement>(720);
  const [active, setActive] = useState<number | null>(null);
  // The drawing scales with the screen; the numbers must not. Keep them about 24px across however small it is drawn.
  const k = Math.max(1, 592 / Math.max(width, 1));
  const r = 15 * k;

  const draw = (delay: number, ms = 2000) => ({
    strokeDasharray: 1,
    strokeDashoffset: seen ? 0 : 1,
    transition: `stroke-dashoffset ${ms}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  });

  return (
    <div ref={ref} className="surface-card overflow-hidden p-4 sm:p-6 md:p-8">
      <svg
        ref={box}
        viewBox="40 28 740 312"
        role="img"
        aria-label="Side view of a Toyota Hiace high-roof bus with six numbered inspection points"
        className="w-full"
      >
        <defs>
          <linearGradient id="hummer-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(223 198 124 / 0.14)" />
            <stop offset="1" stopColor="rgb(223 198 124 / 0.02)" />
          </linearGradient>
          <radialGradient id="hummer-shadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgb(0 0 0 / 0.55)" />
            <stop offset="1" stopColor="rgb(0 0 0 / 0)" />
          </radialGradient>
        </defs>

        <ellipse cx="410" cy="324" rx="390" ry="16" fill="url(#hummer-shadow)" />
        <line x1="20" y1="322" x2="800" y2="322" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1" />

        <g fill="none" stroke="var(--gold-400)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Body */}
          <path
            pathLength={1}
            style={{
              ...draw(0, 2400),
              fill: seen ? "url(#hummer-body)" : "transparent",
              transition: `${draw(0, 2400).transition}, fill 900ms ease 1800ms`,
            }}
            d="M78 300 L70 246 C70 222 80 206 104 200 L164 88 C172 72 186 66 206 65 L700 60 C724 60 734 72 736 94 L744 272 C745 292 734 300 716 300 L656 300 A56 56 0 0 0 544 300 L232 300 A56 56 0 0 0 120 300 Z"
          />
          {/* Windows */}
          <g strokeWidth="1.6" style={{ fill: seen ? "rgb(201 168 76 / 0.07)" : "transparent", transition: "fill 900ms ease 2000ms" }}>
            <path pathLength={1} style={draw(500)} d="M174 96 L256 93 L256 184 L126 186 Z" />
            <rect pathLength={1} style={draw(650)} x="280" y="91" width="114" height="91" rx="6" />
            <rect pathLength={1} style={draw(800)} x="414" y="89" width="124" height="93" rx="6" />
            <rect pathLength={1} style={draw(950)} x="552" y="87" width="136" height="95" rx="10" />
          </g>
          {/* Doors, rail, lamps, mirror */}
          <g strokeWidth="1.4" opacity="0.85">
            <path pathLength={1} style={draw(1100, 1200)} d="M262 90 L262 298" />
            <path pathLength={1} style={draw(1150, 1200)} d="M272 89 L272 298 M406 86 L406 298" />
            <path pathLength={1} style={draw(1250, 1200)} d="M406 196 L704 191" />
            <path pathLength={1} style={draw(1300, 800)} d="M380 214 L396 214" />
            <path pathLength={1} style={draw(1300, 800)} d="M72 232 L96 226 L100 238 L74 244 Z" />
            <path pathLength={1} style={draw(1350, 800)} d="M76 256 L102 251 M77 266 L103 261" />
            <path pathLength={1} style={draw(1400, 800)} d="M150 150 L136 148 L134 170 L148 172" />
            <path pathLength={1} style={draw(1450, 800)} d="M736 200 L744 200 L745 240 L737 240 Z" />
          </g>
          {/* The engine, under the front seats */}
          <rect
            x="132"
            y="210"
            width="108"
            height="76"
            rx="8"
            strokeWidth="1.2"
            strokeDasharray="5 6"
            opacity={seen ? 0.55 : 0}
            style={{ transition: "opacity 700ms ease 1600ms" }}
          />
          {/* Wheels */}
          {[176, 600].map((cx, i) => (
            <g key={cx}>
              <circle pathLength={1} style={draw(700 + i * 150, 1600)} cx={cx} cy="286" r="36" strokeWidth="2.4" />
              <circle pathLength={1} style={draw(900 + i * 150, 1200)} cx={cx} cy="286" r="16" strokeWidth="1.4" />
            </g>
          ))}
        </g>

        {/* Inspection points */}
        {SPOTS.map((s, i) => {
          const on = active === i;
          return (
            <g
              key={s.title}
              role="button"
              tabIndex={seen ? 0 : -1}
              aria-label={`${i + 1}. ${s.title}`}
              onClick={() => setActive(on ? null : i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setActive(on ? null : i))}
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? "scale(1)" : "scale(0.4)",
                transformOrigin: `${s.x}px ${s.y}px`,
                transition: `opacity 400ms ease ${2200 + i * 140}ms, transform 500ms cubic-bezier(0.34,1.56,0.64,1) ${2200 + i * 140}ms`,
                cursor: "pointer",
              }}
            >
              {on && <circle cx={s.x} cy={s.y} r={r * 1.75} fill="rgb(201 168 76 / 0.18)" />}
              <circle cx={s.x} cy={s.y} r={r} fill={on ? "var(--gold-300)" : "var(--gold-500)"} stroke="#0A0908" strokeWidth={3 * k} />
              <text
                x={s.x}
                y={s.y + 5 * k}
                textAnchor="middle"
                fontSize={15 * k}
                fontWeight="700"
                fill="#0A0908"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <ol className="mt-6 grid gap-x-8 gap-y-1 md:grid-cols-2">
        {SPOTS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => setActive(active === i ? null : i)}
              aria-pressed={active === i}
              className={`flex w-full gap-3 rounded-xl p-3 text-left transition-colors ${active === i ? "bg-gold-500/10" : "hover:bg-white/[0.03]"}`}
            >
              <span
                className={`figures mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${active === i ? "bg-gold-300 text-[#0A0908]" : "bg-gold-500/20 text-gold-200"}`}
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold text-text-primary">{s.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-text-secondary">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
