"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { useInView } from "./motion";

interface Field {
  key: keyof Inputs;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: "naira" | "percent";
}

interface Inputs {
  seats: number;
  fare: number;
  full: number;
  trips: number;
  days: number;
  fuel: number;
  driver: number;
  upkeep: number;
}

/**
 * Starting points only — every one is the reader's to change. They are
 * deliberately cautious (three-quarters full, one fare per seat per trip), so
 * nobody leaves this page with a rosier picture than their own route gives.
 */
const START: Inputs = { seats: 14, fare: 1000, full: 75, trips: 6, days: 26, fuel: 30000, driver: 150000, upkeep: 120000 };

const FIELDS: Field[] = [
  { key: "seats", label: "Seats for passengers", min: 8, max: 18, step: 1 },
  { key: "fare", label: "Fare per seat, per trip", min: 200, max: 15000, step: 100, unit: "naira" },
  { key: "full", label: "How full, on average", min: 30, max: 100, step: 5, unit: "percent" },
  { key: "trips", label: "Trips a day", min: 1, max: 12, step: 1 },
  { key: "days", label: "Working days a month", min: 10, max: 30, step: 1 },
  { key: "fuel", label: "Fuel a day", min: 5000, max: 120000, step: 1000, unit: "naira" },
  { key: "driver", label: "Driver a month", min: 0, max: 500000, step: 10000, unit: "naira" },
  { key: "upkeep", label: "Upkeep, levies and the rest, a month", min: 0, max: 600000, step: 10000, unit: "naira" },
];

const show = (f: Field, v: number) => (f.unit === "naira" ? formatNaira(v * 100) : f.unit === "percent" ? `${v}%` : String(v));

/**
 * Will a Hummer bus pay for itself? Not our answer — the reader's, from their
 * own route, fares and costs. The result is what is left each month, and how
 * long it takes to earn back the 40% deposit on a real bus in the showroom.
 */
export function RouteCalculator({ car }: { car: { title: string; slug: string; depositMinor: number } | null }) {
  const id = useId();
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  const [v, setV] = useState<Inputs>(START);

  const takings = v.seats * v.fare * (v.full / 100) * v.trips * v.days;
  const costs = v.fuel * v.days + v.driver + v.upkeep;
  const left = takings - costs;
  const months = car && left > 0 ? car.depositMinor / 100 / left : null;

  return (
    <div ref={ref} className="surface-card grid gap-8 p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:p-10">
      <div className="grid gap-5">
        {FIELDS.map((f) => (
          <label key={f.key} htmlFor={`${id}-${f.key}`} className="grid gap-2">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-text-secondary">{f.label}</span>
              <span className="figures font-semibold text-text-primary">{show(f, v[f.key])}</span>
            </span>
            <input
              id={`${id}-${f.key}`}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={v[f.key]}
              onChange={(e) => setV((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-[var(--gold-400)]"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col justify-center gap-6 md:border-l md:border-white/[0.06] md:pl-8" aria-live="polite">
        <div>
          <p className="text-sm text-text-muted">Takings a month</p>
          <p className="figures mt-1 text-2xl font-semibold text-text-primary">{formatNaira(Math.round(takings) * 100)}</p>
        </div>
        <div>
          <p className="text-sm text-text-muted">Running costs a month</p>
          <p className="figures mt-1 text-2xl font-semibold text-text-secondary">− {formatNaira(Math.round(costs) * 100)}</p>
        </div>
        <div className="border-t border-white/[0.08] pt-5">
          <p className="text-sm text-text-muted">Left each month</p>
          <p
            className={`figures mt-1 font-display text-[2.8rem] leading-none ${left > 0 ? "text-gold" : "text-danger"}`}
            style={{ opacity: seen ? 1 : 0, transition: "opacity 800ms ease 300ms" }}
          >
            {left < 0 && "− "}
            {formatNaira(Math.abs(Math.round(left)) * 100)}
          </p>
        </div>
        {car && (
          <p className="text-sm leading-relaxed text-text-secondary">
            {months ? (
              <>
                At that rate, the 40% deposit on the{" "}
                <Link href={`/vehicles/${car.slug}`} className="text-text-primary underline-offset-4 hover:underline">
                  {car.title}
                </Link>{" "}
                ({formatNaira(car.depositMinor)}) comes back in about{" "}
                <span className="figures font-semibold text-text-primary">{Math.ceil(months)} months</span>.
              </>
            ) : (
              "On these numbers the bus does not cover its costs. Change the route, the fare or the trips before you commit."
            )}
          </p>
        )}
        <p className="text-xs leading-relaxed text-text-muted">
          Your figures, not a promise. Set aside Autochek&rsquo;s monthly repayment too — it is on the bus&rsquo;s Autochek listing.
        </p>
      </div>
    </div>
  );
}
