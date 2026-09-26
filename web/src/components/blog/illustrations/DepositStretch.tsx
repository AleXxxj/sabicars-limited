"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import { useInView, useTween } from "./motion";

export interface StoryCar {
  slug: string;
  title: string;
  priceMinor: number;
  coverUrl: string | null;
}

const PRESETS = [3_000_000, 5_000_000, 8_000_000, 12_000_000, 20_000_000];
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Lane({
  label,
  note,
  reachNaira,
  cars,
  maxNaira,
  gold,
  seen,
  shortfall,
}: {
  label: string;
  note: string;
  reachNaira: number;
  cars: StoryCar[];
  maxNaira: number;
  gold: boolean;
  seen: boolean;
  shortfall: React.ReactNode;
}) {
  // Counts up from nothing when first seen, then glides with every change of amount.
  const shown = useTween(seen ? reachNaira : 0, 900);
  const inReach = cars.filter((c) => c.priceMinor <= reachNaira * 100);
  // The most car the money reaches — the last one it can afford.
  const pick = inReach[inReach.length - 1];
  const width = shown > 0 ? Math.max(3, Math.min(100, (shown / maxNaira) * 100)) : 0;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 md:p-6 ${gold ? "border-gold-500/40 bg-[linear-gradient(160deg,rgb(201_168_76/0.12),transparent_55%)]" : "border-white/[0.08] bg-white/[0.02]"}`}
    >
      <p className={`text-xs font-semibold tracking-[0.16em] uppercase ${gold ? "text-gold-300" : "text-text-muted"}`}>{label}</p>
      <p className="mt-1 text-sm text-text-muted">{note}</p>
      <p
        className={`figures mt-4 font-display leading-none ${gold ? "text-gold text-[2.6rem] md:text-[3rem]" : "text-[2.2rem] text-text-primary md:text-[2.5rem]"}`}
      >
        {formatNaira(Math.round(shown) * 100)}
      </p>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div
          className={`h-full rounded-full ${gold ? "bg-[linear-gradient(90deg,var(--gold-500),var(--gold-200))] shadow-[0_0_18px_rgb(201_168_76/0.6)]" : "bg-white/35"}`}
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
              <span className="block truncate font-semibold text-text-primary group-hover:text-gold-200">{pick.title}</span>
              <span className="figures block text-sm text-text-secondary">{formatNaira(pick.priceMinor)}</span>
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
 * buys in cash, the other what it reaches as a 40% Drive Plan deposit — both
 * against the cars actually in the showroom, and the best car each reaches.
 */
export function DepositStretch({ cars, start = 5_000_000 }: { cars: StoryCar[]; start?: number }) {
  const id = useId();
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [text, setText] = useState(grouped(start));
  const naira = Number(text.replace(/\D/g, "")) || 0;
  const cashReach = naira;
  const planReach = Math.floor(naira / 0.4);
  const cheapest = cars[0];
  const cheapestDeposit = cheapest ? Math.ceil((cheapest.priceMinor * 0.4) / 100) : 0;
  const maxNaira = Math.max(planReach, (cars[cars.length - 1]?.priceMinor ?? 0) / 100) || 1;

  return (
    <div ref={ref} className="surface-card p-5 md:p-8">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        You have
      </label>
      <div className="mt-2 flex items-baseline gap-2 border-b border-border-strong pb-2 transition-colors focus-within:border-gold-500">
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
            className="figures min-h-10 rounded-full border border-border-default px-4 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary aria-pressed:border-gold-500 aria-pressed:bg-gold-500/10 aria-pressed:text-gold-200"
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
          cars={cars}
          maxNaira={maxNaira}
          gold={false}
          seen={seen}
          shortfall="At this amount, cash is older-car money — below anything in the Sabicars showroom today."
        />
        <Lane
          label="40% Drive Plan"
          note="Your deposit reaches a car up to"
          reachNaira={planReach}
          cars={cars}
          maxNaira={maxNaira}
          gold
          seen={seen}
          shortfall={
            cheapest ? (
              <>
                Not quite yet: a deposit of{" "}
                <span className="figures font-semibold text-text-primary">{formatNaira(cheapestDeposit * 100)}</span> reaches the{" "}
                <Link href={`/vehicles/${cheapest.slug}`}>{cheapest.title}</Link> —{" "}
                <span className="figures">{formatNaira(Math.max(0, cheapestDeposit - naira) * 100)}</span> more.
              </>
            ) : (
              "Nothing listed right now."
            )
          }
        />
      </div>
      <p className="mt-5 text-xs leading-relaxed text-text-muted">
        On the Drive Plan, Autochek finances the other 60% once it approves, on the terms set on the car’s listing. Prices are the
        showroom’s today.
      </p>
    </div>
  );
}
