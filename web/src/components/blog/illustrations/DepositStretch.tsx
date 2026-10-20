"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";
import { depositPercentLabel, reachMinorFor } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";
import { useInView, useTween } from "./motion";

export interface StoryCar {
  slug: string;
  title: string;
  priceMinor: number;
  coverUrl: string | null;
}

/** A car that can go on the Drive Plan, with its own deposit: 40% from 2010, 50% for 2008–2009 (lib/drive-plan.ts). */
export interface PlanCar extends StoryCar {
  year: number;
  depositMinor: number;
}

/** A car in a lane: the cash lane takes any priced car, the plan lane only cars with a deposit. */
type LaneCar = StoryCar & Partial<Pick<PlanCar, "year" | "depositMinor">>;

const PRESETS = [3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000];
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Lane({
  label,
  note,
  reachNaira,
  inReach,
  maxNaira,
  gold,
  plan,
  seen,
  shortfall,
}: {
  label: string;
  note: string;
  reachNaira: number;
  /** The cars in the showroom this money reaches, cheapest first. */
  inReach: LaneCar[];
  maxNaira: number;
  gold: boolean;
  /** The Drive Plan lane shows each car's own deposit beside its price. */
  plan: boolean;
  seen: boolean;
  shortfall: React.ReactNode;
}) {
  // Counts up from nothing when first seen, then glides with every change of amount.
  const shown = useTween(seen ? reachNaira : 0, 900);
  // The most car the money reaches — the last one it can afford.
  const pick = inReach[inReach.length - 1];
  const pct = pick?.year !== undefined ? depositPercentLabel(pick.year) : null;
  const width = shown > 0 ? Math.max(3, Math.min(100, (shown / maxNaira) * 100)) : 0;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 md:p-6 ${gold ? "border-green-500/40 bg-[linear-gradient(160deg,rgb(120_176_48/0.12),transparent_55%)]" : "border-white/[0.08] bg-white/[0.02]"}`}
    >
      <p className={`text-xs font-semibold tracking-[0.16em] uppercase ${gold ? "text-green-300" : "text-text-muted"}`}>{label}</p>
      <p className="mt-1 text-sm text-text-muted">{note}</p>
      <p
        className={`figures mt-4 font-display leading-none ${gold ? "text-brand text-[2.6rem] md:text-[3rem]" : "text-[2.2rem] text-text-primary md:text-[2.5rem]"}`}
      >
        {formatNaira(Math.round(shown) * 100)}
      </p>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div
          className={`h-full rounded-full ${gold ? "bg-[linear-gradient(90deg,var(--green-500),var(--green-200))] shadow-[0_0_18px_rgb(120_176_48/0.6)]" : "bg-white/35"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="figures mt-3 text-sm text-text-secondary">
        {inReach.length ? (
          <>
            <span className="font-semibold text-text-primary">{inReach.length}</span> {inReach.length === 1 ? "car" : "cars"} in the
            showroom within reach
          </>
        ) : (
          "Nothing in the showroom within reach"
        )}
      </p>
      <div className="mt-4 flex-1">
        {pick ? (
          <Link
            href={`/vehicles/${pick.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-surface-0/60 p-2.5 pr-4 !no-underline"
          >
            <span className="relative block aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {pick.coverUrl && (
                <VehicleImage
                  key={pick.slug}
                  src={pick.coverUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="animate-[prompt-in_var(--duration-base)_var(--ease-out)] object-cover"
                />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-text-muted">The most it reaches today</span>
              <span className="block truncate font-semibold text-text-primary group-hover:text-green-200">{pick.title}</span>
              <span className="figures block text-sm text-text-secondary">
                {formatNaira(pick.priceMinor)}
                {plan && pick.depositMinor !== undefined && (
                  <span className="text-green-300">
                    {" "}
                    · {formatNaira(pick.depositMinor)} down{pct ? ` (${pct})` : ""}
                  </span>
                )}
              </span>
            </span>
          </Link>
        ) : (
          <p className="text-sm leading-relaxed text-text-muted">{shortfall}</p>
        )}
      </div>
    </div>
  );
}

/**
 * The same money, two ways. The reader sets an amount; one lane shows what it
 * buys in cash, the other what it reaches as a Drive Plan deposit (40% on a car
 * from 2010, 50% on a 2008 or 2009 car) — both against the cars actually in the
 * showroom, each tested on its own deposit, and the best car each reaches.
 *
 * `cars` are the ones Autochek would finance; `cashCars` is every priced car,
 * because cash also buys the older cars the plan does not cover.
 */
export function DepositStretch({ cars, cashCars = cars, start = 5_000_000 }: { cars: PlanCar[]; cashCars?: StoryCar[]; start?: number }) {
  const id = useId();
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [text, setText] = useState(grouped(start));
  const naira = Number(text.replace(/\D/g, "")) || 0;
  const cashReach = naira;
  // The headline figure is the reach on a car from 2010; the cars themselves are tested on their own deposit.
  const planReach = Math.floor(reachMinorFor(naira * 100) / 100);
  const inCash = cashCars.filter((c) => c.priceMinor <= naira * 100);
  const onPlan = cars.filter((c) => c.depositMinor <= naira * 100);
  // The car needing the least down — not always the cheapest, since a 2008 or 2009 car needs 50%.
  const easiest = cars.reduce<PlanCar | null>((a, c) => (a && a.depositMinor <= c.depositMinor ? a : c), null);
  const easiestPct = easiest ? depositPercentLabel(easiest.year) : null;
  const dearest = Math.max(cars[cars.length - 1]?.priceMinor ?? 0, cashCars[cashCars.length - 1]?.priceMinor ?? 0);
  const maxNaira = Math.max(planReach, dearest / 100) || 1;

  return (
    <div ref={ref} className="surface-card p-5 md:p-8">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        You have
      </label>
      <div className="mt-2 flex items-baseline gap-2 border-b border-border-strong pb-2 transition-colors focus-within:border-green-500">
        <span aria-hidden className="font-display text-[2.4rem] leading-none text-text-muted md:text-[2.8rem]">
          ₦
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
            setText(digits ? grouped(Number(digits)) : "");
          }}
          className="figures w-full min-w-0 bg-transparent font-display text-[2.4rem] leading-none text-text-primary outline-none md:text-[2.8rem]"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setText(grouped(p))}
            aria-pressed={naira === p}
            className="figures min-h-10 rounded-full border border-border-default px-4 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary aria-pressed:border-green-500 aria-pressed:bg-green-500/10 aria-pressed:text-green-200"
          >
            {formatNaira(p * 100, { compact: true })}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2" aria-live="polite">
        <Lane
          label="Pay cash"
          note="A car up to"
          reachNaira={cashReach}
          inReach={inCash}
          maxNaira={maxNaira}
          gold={false}
          plan={false}
          seen={seen}
          shortfall="At this amount, cash is older-car money — below anything in the Sabicars showroom today."
        />
        <Lane
          label="40% Drive Plan"
          note="Your deposit reaches a car from 2010 up to"
          reachNaira={planReach}
          inReach={onPlan}
          maxNaira={maxNaira}
          gold
          plan
          seen={seen}
          shortfall={
            easiest ? (
              <>
                Not quite yet: a{easiestPct ? ` ${easiestPct}` : ""} deposit of{" "}
                <span className="figures font-semibold text-text-primary">{formatNaira(easiest.depositMinor)}</span> reaches the{" "}
                <Link href={`/vehicles/${easiest.slug}`}>{easiest.title}</Link> —{" "}
                <span className="figures">{formatNaira(Math.max(0, easiest.depositMinor - naira * 100))}</span> more.
              </>
            ) : (
              "Nothing listed right now."
            )
          }
        />
      </div>
      <p className="mt-5 text-xs leading-relaxed text-text-muted">
        On the Drive Plan, Autochek finances the rest — 60% of a car from 2010, 50% of a 2008 or 2009 car — once it approves, on terms
        its lender sets when it assesses you. Prices are the showroom’s today.
      </p>
    </div>
  );
}
