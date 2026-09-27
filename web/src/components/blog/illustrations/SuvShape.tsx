import type { Shape } from "./suvs";

const BODY: Record<Shape, { body: string; glass: string }> = {
  crossover: {
    body: "M6 34 L6 22 C7 14 12 11 20 10 L44 8 L66 8 C74 9 79 14 84 20 L94 23 C97 24 98 27 98 30 L98 34 Z",
    glass: "M22 20 L25 13 L44 11 L64 11 C70 12 74 15 78 20 Z",
  },
  boxy: {
    body: "M6 34 L6 12 C6 9 8 8 11 8 L68 7 C73 7 76 10 79 17 L81 20 L93 22 C97 23 98 26 98 30 L98 34 Z",
    glass: "M10 19 L10 11 L66 10 C70 10 72 13 75 19 Z",
  },
  sleek: {
    body: "M6 34 L7 20 C8 14 12 11 20 11 L46 9 L66 9 C73 10 78 14 83 20 L94 23 C97 24 98 27 98 30 L98 34 Z",
    glass: "M20 19 L23 13 L46 12 L65 12 C71 12 75 15 79 19 Z",
  },
};

/** A small side view of an SUV, facing right; the wheels turn with `turn` (degrees). */
export function SuvShape({ shape, color, turn = 0, className = "" }: { shape: Shape; color: string; turn?: number; className?: string }) {
  const s = BODY[shape];
  return (
    <svg viewBox="0 0 100 44" className={className} aria-hidden>
      <path d={s.body} fill={color} stroke="rgb(255 255 255 / 0.35)" strokeWidth="1" />
      <path d={s.glass} fill="#0e1318" opacity="0.9" />
      <rect x="92" y="25" width="5" height="3" rx="1" fill="#fff4cf" />
      {[24, 78].map((x) => (
        <g key={x} transform={`rotate(${turn} ${x} 34)`}>
          <circle cx={x} cy="34" r="8.5" fill="#0B0A09" />
          <circle cx={x} cy="34" r="6" fill="#2b2926" stroke="#6b645a" strokeWidth="1.5" />
          <line x1={x} y1="29" x2={x} y2="39" stroke="#9a9184" strokeWidth="1.6" />
          <line x1={x - 5} y1="34" x2={x + 5} y2="34" stroke="#9a9184" strokeWidth="1.6" />
        </g>
      ))}
    </svg>
  );
}
