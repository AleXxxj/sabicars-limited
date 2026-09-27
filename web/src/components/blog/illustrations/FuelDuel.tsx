"use client";

import { useId, useState } from "react";
import { Fuel } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { useInView } from "./motion";
import { RollingNumber } from "./rewards";

/**
 * Official combined figures, rounded: the Highlander's 3.5 V6 around 22 mpg
 * (10.7 L/100 km), the GX 460's 4.6 V8 around 17 mpg (13.8 L/100 km). Lagos
 * traffic raises both; the gap between them is what matters.
 */
const CARS = [
  { name: "Toyota Highlander", engine: "3.5 V6", per100: 10.7 },
  { name: "Lexus GX 460", engine: "4.6 V8", per100: 13.8 },
];

const naira = (n: number) => formatNaira(Math.round(n) * 100);

function Pump({
  name,
  engine,
  per100,
  litres,
  cost,
  max,
  seen,
  thirsty,
}: (typeof CARS)[number] & { litres: number; cost: number; max: number; seen: boolean; thirsty: boolean }) {
  const fill = seen ? Math.max(0.04, Math.min(1, cost / max)) : 0;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 ${thirsty ? "border-white/[0.1] bg-white/[0.02]" : "border-gold-500/40 bg-[linear-gradient(170deg,rgb(201_168_76/0.14),transparent_60%)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text-primary">{name}</p>
          <p className="text-xs text-text-muted">
            {engine} · about {per100} L per 100 km
          </p>
        </div>
        <Fuel aria-hidden size={22} className={thirsty ? "text-text-muted" : "text-gold-300"} />
      </div>
      {/* The pump's display */}
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0b0d0c] px-4 py-3 shadow-[inset_0_2px_12px_rgb(0_0_0/0.6)]">
        <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#7fd8a4] uppercase">Naira a month</p>
        <RollingNumber
          value={seen ? cost : 0}
          format={naira}
          className="mt-1 text-[2rem] font-semibold text-[#b8f5cf] [text-shadow:0_0_14px_rgb(127_216_164/0.55)] md:text-[2.3rem]"
        />
        <p className="mt-2 text-[0.68rem] font-semibold tracking-[0.18em] text-[#7fd8a4]/80 uppercase">Litres</p>
        <RollingNumber
          value={seen ? Math.round(litres) : 0}
          format={(n) => n.toLocaleString("en-NG")}
          className="mt-1 text-lg text-[#b8f5cf]/85"
        />
      </div>
      {/* How full the month's tank of money is */}
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)] ${thirsty ? "bg-white/40" : "bg-[linear-gradient(90deg,var(--gold-500),var(--gold-200))] shadow-[0_0_14px_rgb(201_168_76/0.6)]"}`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
    </div>
  );
}

/** What each one costs to fuel, on the reader's own driving and today's pump price. */
export function FuelDuel() {
  const id = useId();
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const [kmWeek, setKmWeek] = useState(300);
  const [price, setPrice] = useState(1000);
  const kmMonth = (kmWeek * 52) / 12;
  const rows = CARS.map((c) => {
    const litres = (kmMonth * c.per100) / 100;
    return { ...c, litres, cost: litres * price };
  });
  const [hl, gx] = rows;
  const gapMonth = gx.cost - hl.cost;
  const gapYear = gapMonth * 12;
  const months = hl.cost > 0 ? gapYear / hl.cost : 0;

  return (
    <div ref={ref} className="surface-card p-5 md:p-8">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-end">
        <label htmlFor={`${id}-km`} className="block">
          <span className="text-sm text-text-secondary">How far you drive in a week</span>
          <span className="figures mt-1 block font-display text-[2.4rem] leading-none text-text-primary">
            {kmWeek.toLocaleString("en-NG")} km
          </span>
          <input
            id={`${id}-km`}
            type="range"
            min={50}
            max={1500}
            step={10}
            value={kmWeek}
            onChange={(e) => setKmWeek(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--gold-400)]"
          />
          <span className="mt-1 flex justify-between text-xs text-text-muted">
            <span>Around town</span>
            <span>Lagos–Abuja, twice</span>
          </span>
        </label>
        <label htmlFor={`${id}-price`} className="block">
          <span className="text-sm text-text-secondary">Today’s pump price, per litre</span>
          <span className="mt-2 flex items-center rounded-xl border border-border-default bg-surface-1 px-4 focus-within:border-gold-500">
            <span className="text-text-muted">₦</span>
            <input
              id={`${id}-price`}
              inputMode="numeric"
              value={price.toLocaleString("en-NG")}
              onChange={(e) => setPrice(Math.min(10_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
              className="figures min-h-12 w-full bg-transparent px-2 text-lg text-text-primary outline-none"
            />
          </span>
          <span className="mt-1 block text-xs text-text-muted">Change it to what you paid this week.</span>
        </label>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {rows.map((r, i) => (
          <Pump key={r.name} {...r} max={gx.cost || 1} seen={seen} thirsty={i === 1} />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-5 text-center">
        <p className="text-sm text-text-secondary">A year of the difference</p>
        <RollingNumber
          value={seen ? gapYear : 0}
          format={naira}
          className="mt-1 font-display text-[2.4rem] text-gold-200 md:text-[2.9rem]"
        />
        <p className="mt-2 text-sm text-text-secondary">
          The GX 460 costs <span className="figures font-semibold text-text-primary">{naira(gapMonth)}</span> more a month to fuel — about{" "}
          <span className="figures font-semibold text-text-primary">{months.toFixed(1)} months</span> of the Highlander’s fuel, every year.
        </p>
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Official combined fuel figures, rounded. Lagos traffic raises both, and the GX still uses roughly 30% more.
      </p>
    </div>
  );
}
