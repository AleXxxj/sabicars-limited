"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { useTween } from "./motion";
import { Burst, haptic } from "./rewards";
import { AXES, SUVS, type Suv, type SuvStock } from "./suvs";

const R = 138;
const C = 200;
const angle = (i: number) => (-90 + i * 60) * (Math.PI / 180);
const point = (i: number, v: number) => [C + Math.cos(angle(i)) * (v / 5) * R, C + Math.sin(angle(i)) * (v / 5) * R] as const;

/** The six ratings of one SUV, each gliding to its new value when the choice changes. */
function useShape(suv: Suv | undefined) {
  const t = AXES.map((a) => (suv ? suv.ratings[a.id] : 0));
  const v0 = useTween(t[0], 700);
  const v1 = useTween(t[1], 760);
  const v2 = useTween(t[2], 820);
  const v3 = useTween(t[3], 700);
  const v4 = useTween(t[4], 760);
  const v5 = useTween(t[5], 820);
  return [v0, v1, v2, v3, v4, v5];
}

function polygon(values: number[]) {
  return values.map((v, i) => point(i, v).join(",")).join(" ");
}

const COLOURS = [
  { stroke: "var(--gold-300)", fill: "rgb(201 168 76 / 0.28)", chip: "border-gold-400 bg-gold-500/15 text-gold-100" },
  { stroke: "#c9d3dd", fill: "rgb(201 211 221 / 0.16)", chip: "border-[#c9d3dd]/70 bg-white/[0.08] text-text-primary" },
];

/**
 * All five SUVs on the six things that matter here, as a shape. Pick any two
 * and the shapes morph to show where each one leads — the fastest way to see
 * that no SUV wins everything.
 */
export function SuvRadar({ stock }: { stock: SuvStock }) {
  const [picked, setPicked] = useState<string[]>(["prado", "gle"]);
  const [fire, setFire] = useState(0);
  const a = SUVS.find((s) => s.id === picked[0]);
  const b = SUVS.find((s) => s.id === picked[1]);
  const shapeA = useShape(a);
  const shapeB = useShape(b);

  const toggle = (id: string) => {
    haptic(8);
    if (picked.includes(id)) return setPicked(picked.filter((x) => x !== id));
    setPicked(picked.length < 2 ? [...picked, id] : [picked[0], id]);
    setFire((f) => f + 1);
  };

  const leads = (x: Suv, y: Suv) => AXES.filter((ax) => x.ratings[ax.id] > y.ratings[ax.id]).map((ax) => ax.label.toLowerCase());

  return (
    <div className="surface-card grid items-center gap-6 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:p-8">
      <div className="relative mx-auto w-full max-w-md">
        <svg
          viewBox="0 0 400 400"
          className="block w-full overflow-visible"
          role="img"
          aria-label={`Ratings of the ${[a, b]
            .filter(Boolean)
            .map((s) => s!.name)
            .join(" and ")}`}
        >
          {[1, 2, 3, 4, 5].map((ring) => (
            <polygon key={ring} points={polygon(AXES.map(() => ring))} fill="none" stroke="rgb(255 255 255 / 0.08)" />
          ))}
          {AXES.map((ax, i) => {
            const [x, y] = point(i, 5);
            const [lx, ly] = point(i, 6.15);
            return (
              <g key={ax.id}>
                <line x1={C} y1={C} x2={x} y2={y} stroke="rgb(255 255 255 / 0.08)" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fontWeight="600"
                  fill="var(--text-secondary)"
                >
                  {ax.short}
                </text>
              </g>
            );
          })}
          {b && (
            <polygon points={polygon(shapeB)} fill={COLOURS[1].fill} stroke={COLOURS[1].stroke} strokeWidth="2.5" strokeLinejoin="round" />
          )}
          {a && (
            <polygon points={polygon(shapeA)} fill={COLOURS[0].fill} stroke={COLOURS[0].stroke} strokeWidth="2.5" strokeLinejoin="round" />
          )}
          {[a && shapeA, b && shapeB].map((shape, k) =>
            shape
              ? shape.map((v, i) => {
                  const [x, y] = point(i, v);
                  return <circle key={`${k}-${i}`} cx={x} cy={y} r="4.5" fill={COLOURS[k].stroke} />;
                })
              : null,
          )}
        </svg>
        <span className="absolute top-1/2 left-1/2">
          <Burst fire={fire} />
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-text-primary">Pick any two</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUVS.map((s) => {
            const k = picked.indexOf(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={k >= 0}
                onClick={() => toggle(s.id)}
                className={`min-h-11 rounded-full border px-4 text-sm transition-all active:scale-95 ${k >= 0 ? `${COLOURS[k].chip} font-semibold` : "border-white/[0.12] text-text-secondary hover:border-white/30 hover:text-text-primary"}`}
              >
                {s.short}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 text-sm text-text-secondary" aria-live="polite">
          {a && b ? (
            [
              [a, b, 0],
              [b, a, 1],
            ].map(([x, y, k]) => {
              const l = leads(x as Suv, y as Suv);
              const s = stock[(x as Suv).id];
              return (
                <div key={(x as Suv).id} className="border-l-2 pl-4" style={{ borderColor: COLOURS[k as number].stroke }}>
                  <p className="font-semibold text-text-primary">{(x as Suv).name}</p>
                  <p className="mt-1">{l.length ? `Leads on ${l.join(", ")}.` : "Leads on nothing here — but ties on a lot."}</p>
                  {s?.count ? (
                    <Link
                      href={(x as Suv).term ? `/buy/${(x as Suv).term}` : "/vehicles"}
                      className="group mt-1.5 inline-flex min-h-9 items-center gap-1.5 font-semibold text-gold-300 hover:text-gold-200"
                    >
                      {s.count} in the showroom{s.fromMinor ? `, from ${formatNaira(s.fromMinor)}` : ""}
                      <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p>Pick a second SUV to compare.</p>
          )}
        </div>
        <p className="mt-5 text-xs text-text-muted">Our ratings out of five: editorial judgement, not laboratory tests.</p>
      </div>
    </div>
  );
}
