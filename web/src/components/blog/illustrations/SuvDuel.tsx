"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { comparePath } from "@/lib/assistant/parts";
import { formatNaira } from "@/lib/money";
import type { StoryCar } from "./DepositStretch";
import { useReducedMotion, useSpring } from "./motion";
import { Burst, haptic } from "./rewards";

type Side = "hl" | "gx";

const PRIORITIES: { id: string; label: string; side: Side; weight: number; why: string }[] = [
  { id: "rough", label: "Bad roads and floods", side: "gx", weight: 2, why: "A ladder frame and low-range 4WD take the punishment." },
  { id: "fuel", label: "Fuel costs", side: "hl", weight: 2, why: "The V6 uses about a fifth less fuel than the V8." },
  { id: "price", label: "Buying price", side: "hl", weight: 2, why: "A Highlander of the same year usually costs less." },
  { id: "city", label: "A smooth, quiet city ride", side: "hl", weight: 1, why: "Built like a car, it rides like one." },
  { id: "row3", label: "Adults in the third row", side: "hl", weight: 1, why: "Its third row is roomier; the GX’s suits children best." },
  { id: "luxury", label: "Luxury inside", side: "gx", weight: 1, why: "Lexus leather, wood and hush." },
  { id: "tow", label: "Towing and heavy loads", side: "gx", weight: 1, why: "The V8 and the frame are made for weight." },
  { id: "badge", label: "The Lexus badge", side: "gx", weight: 1, why: "Presence counts, and it has it." },
];

const NAMES: Record<Side, string> = { hl: "Toyota Highlander", gx: "Lexus GX 460" };

/** One weight on a pan: it drops in from above and settles with a small bounce. */
function Weight({ label, heavy }: { label: string; heavy: boolean }) {
  return (
    <div
      className={`drop-in flex items-center justify-center rounded-md border px-2 py-1 text-center text-[0.62rem] leading-tight font-semibold text-[#0A0908] shadow-[0_4px_10px_rgb(0_0_0/0.45)] sm:text-[0.72rem] ${heavy ? "min-h-9 border-gold-200/60 bg-[linear-gradient(180deg,var(--gold-200),var(--gold-500))]" : "min-h-7 border-gold-100/60 bg-[linear-gradient(180deg,var(--gold-100),var(--gold-400))]"}`}
    >
      {label}
    </div>
  );
}

/**
 * What matters to you? Every priority the reader taps drops a weight onto the
 * car it favours, and the balance tips — slowly, like a real one — towards
 * the SUV that suits them.
 */
export function SuvDuel({ highlanders, gxs }: { highlanders: StoryCar[]; gxs: StoryCar[] }) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState<string[]>([]);
  const [fire, setFire] = useState<Record<Side, number>>({ hl: 0, gx: 0 });
  const [lean, setLean] = useState<Side | null>(null);

  const chosen = PRIORITIES.filter((p) => on.includes(p.id));
  const score = { hl: 0, gx: 0 };
  for (const p of chosen) score[p.side] += p.weight;
  const diff = score.gx - score.hl;
  const angle = useSpring(Math.max(-13, Math.min(13, diff * 3.2)), { stiffness: 60, damping: 7 });
  const winner: Side | null = diff > 0 ? "gx" : diff < 0 ? "hl" : null;

  const toggle = (id: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    setOn(next);
    haptic(8);
    const s = { hl: 0, gx: 0 };
    for (const p of PRIORITIES.filter((q) => next.includes(q.id))) s[p.side] += p.weight;
    const w: Side | null = s.gx > s.hl ? "gx" : s.gx < s.hl ? "hl" : null;
    if (w && w !== lean) {
      setFire((f) => ({ ...f, [w]: f[w] + 1 }));
      haptic([10, 30, 14]);
    }
    setLean(w);
  };

  // The beam: 600 wide, pivot at the centre; pans hang from its ends and stay level.
  const rad = (angle * Math.PI) / 180;
  const half = 250;
  const end = (side: -1 | 1) => ({ x: 300 + side * half * Math.cos(rad), y: 70 + side * half * Math.sin(rad) });
  const left = end(-1);
  const right = end(1);
  const stock = winner === "gx" ? gxs : winner === "hl" ? highlanders : [];

  return (
    <div className="surface-card overflow-hidden p-5 md:p-8">
      <p className="text-sm font-semibold text-text-primary">What matters most to you? Tap all that apply.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PRIORITIES.map((p) => {
          const active = on.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(p.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-all duration-200 active:scale-95 ${active ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100 shadow-[0_0_18px_rgb(201_168_76/0.25)]" : "border-white/[0.12] text-text-secondary hover:border-gold-500/40 hover:text-text-primary"}`}
            >
              {active && <Check aria-hidden size={15} />}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* The balance */}
      <div className="mx-auto mt-6 w-full max-w-2xl pt-40 sm:pt-44">
        <div className="relative">
          <svg viewBox="0 0 600 190" className="block w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="duel-beam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--gold-200)" />
                <stop offset="1" stopColor="var(--gold-600)" />
              </linearGradient>
            </defs>
            {/* Stand */}
            <path d="M300 74 L262 180 L338 180 Z" fill="#2a2724" stroke="rgb(255 255 255 / 0.08)" />
            <rect x="230" y="178" width="140" height="8" rx="4" fill="#1d1b18" />
            {/* Beam */}
            <g transform={`rotate(${angle} 300 70)`}>
              <rect x="46" y="64" width="508" height="12" rx="6" fill="url(#duel-beam)" />
              <circle cx="50" cy="70" r="6" fill="var(--gold-100)" />
              <circle cx="550" cy="70" r="6" fill="var(--gold-100)" />
            </g>
            <circle cx="300" cy="70" r="11" fill="#0B0A09" stroke="var(--gold-300)" strokeWidth="3" />
            {/* Pans hang level from each end */}
            {[left, right].map((p, i) => (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={p.x - 70} y2={p.y + 70} stroke="rgb(223 198 124 / 0.5)" />
                <line x1={p.x} y1={p.y} x2={p.x + 70} y2={p.y + 70} stroke="rgb(223 198 124 / 0.5)" />
                <path
                  d={`M${p.x - 84} ${p.y + 70} L${p.x + 84} ${p.y + 70} L${p.x + 70} ${p.y + 82} L${p.x - 70} ${p.y + 82} Z`}
                  fill="#3a3632"
                  stroke="rgb(223 198 124 / 0.4)"
                />
              </g>
            ))}
          </svg>

          {/* Weights, stacked on each pan — positioned over the SVG in percentages of its box */}
          {(["hl", "gx"] as Side[]).map((side) => {
            const p = side === "hl" ? left : right;
            const stack = chosen.filter((c) => c.side === side);
            return (
              <div
                key={side}
                className="absolute flex w-[26%] -translate-x-1/2 flex-col-reverse gap-1"
                style={{ left: `${(p.x / 600) * 100}%`, bottom: `${(1 - (p.y + 70) / 190) * 100}%` }}
              >
                <span className="relative block h-0">
                  <Burst fire={fire[side]} />
                </span>
                <p
                  className={`pb-1 text-center text-xs font-semibold tracking-wide ${winner === side ? "text-gold-200" : "text-text-muted"}`}
                >
                  {side === "hl" ? "Highlander" : "GX 460"}
                </p>
                {stack.map((c) => (
                  <Weight key={c.id} label={c.label} heavy={c.weight > 1} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* The verdict */}
      <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-center" aria-live="polite">
        {!chosen.length ? (
          <p className="text-text-secondary">Tap a priority and watch the balance move.</p>
        ) : winner ? (
          <>
            <p className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">For you, the balance tips to</p>
            <p
              key={winner}
              className={`${reduced ? "" : "pop-in"} mt-1 font-display text-[2rem] leading-tight text-text-primary md:text-[2.4rem]`}
            >
              {NAMES[winner]}
            </p>
            <ul className="mx-auto mt-3 grid max-w-xl gap-1 text-left text-sm text-text-secondary">
              {chosen
                .filter((c) => c.side === winner)
                .map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <Check aria-hidden size={15} className="mt-0.5 shrink-0 text-gold-300" />
                    <span>
                      <span className="text-text-primary">{c.label}:</span> {c.why}
                    </span>
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p className="text-text-secondary">
            <span className="font-semibold text-text-primary">Dead level.</span> What matters to you pulls both ways — drive both before you
            decide.
          </p>
        )}
      </div>

      {stock.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {stock.slice(0, 2).map((c) => (
            <Link
              key={c.slug}
              href={`/vehicles/${c.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-white/[0.08] bg-surface-0/50 p-2.5 pr-4 hover:border-gold-500/40"
            >
              <span className="relative block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {c.coverUrl && <VehicleImage src={c.coverUrl} alt="" fill sizes="96px" className="object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-text-primary">{c.title}</span>
                <span className="figures block text-sm text-gold-300">{formatNaira(c.priceMinor)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {highlanders[0] && gxs[0] && (
        <Link
          href={comparePath([highlanders[0].slug, gxs[0].slug])}
          className="group mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
        >
          Put a Highlander and a GX side by side{" "}
          <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
