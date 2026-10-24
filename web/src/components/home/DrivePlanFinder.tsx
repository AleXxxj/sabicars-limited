"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { DEFAULT_ESTIMATE_MONTHS, DRIVE_PLAN, depositPercentLabel, monthlyAtCeilingMinor, reachMinorFor } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";

export interface FinderVehicle {
  slug: string;
  title: string;
  year: number;
  priceMinor: number;
  /** This car's own deposit: 40% from 2010, 50% for 2008–2009. Cars Autochek would not finance are not in the list. */
  depositMinor: number;
  coverUrl: string | null;
}

/** Amounts people actually arrive with, in naira. */
const PRESETS = [3_000_000, 5_000_000, 10_000_000, 20_000_000];
const START = 10_000_000;

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * "What can I drive home with what I have?" — the question Sabicars' audience
 * actually arrives with, answered from live stock as they type. On the Drive
 * Plan a deposit goes up to two and a half times as far as cash; this makes
 * that concrete with real cars, each at its own deposit, rather than a
 * percentage.
 */
export function DrivePlanFinder({ vehicles, children }: { vehicles: FinderVehicle[]; children: React.ReactNode }) {
  const cheapest = vehicles.reduce<FinderVehicle | null>((best, v) => (best === null || v.depositMinor < best.depositMinor ? v : best), null);
  // The quick amounts start at the smallest deposit that drives a car home today, rounded up to the next ₦100,000,
  // so every button finds a car and they follow the stock as cheaper cars arrive.
  const floor = cheapest ? Math.ceil(cheapest.depositMinor / 100 / 100_000) * 100_000 : 0;
  const presets = floor ? [floor, ...PRESETS.filter((p) => p > floor)] : PRESETS;
  const [text, setText] = useState(grouped(Math.max(START, floor)));
  const inputId = useId();
  const naira = Number(text.replace(/\D/g, "")) || 0;
  const budgetMinor = naira * 100;

  // `vehicles` is cheapest first, so the last few within reach are the most car for the money.
  const within = vehicles.filter((v) => v.depositMinor <= budgetMinor);
  const inFull = vehicles.filter((v) => v.priceMinor <= budgetMinor).length;
  const picks = within.slice(-4).reverse();
  const reachNaira = Math.floor(reachMinorFor(budgetMinor) / 100);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
      <div>
        {children}

        <div className="mt-10 border-t border-white/[0.08] pt-6">
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            I can put down
          </label>
          <div className="mt-3 flex items-baseline gap-2 border-b border-border-strong pb-2 transition-colors focus-within:border-green-500">
            <span aria-hidden className="font-display text-[2.4rem] leading-none text-text-muted md:text-[3rem]">
              ₦
            </span>
            <input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              value={text}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
                setText(digits ? grouped(Number(digits)) : "");
              }}
              placeholder="0"
              aria-describedby={`${inputId}-result`}
              className="figures w-full min-w-0 bg-transparent font-display text-[2.4rem] leading-none text-text-primary outline-none placeholder:text-text-muted md:text-[3rem]"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setText(grouped(p))}
                aria-pressed={naira === p}
                className="figures min-h-11 rounded-full border border-border-default bg-surface-1 px-5 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary aria-pressed:border-green-500 aria-pressed:bg-green-500/10 aria-pressed:text-green-200"
              >
                {formatNaira(p * 100, { compact: true })}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-text-muted">
            Cars from {DRIVE_PLAN.standardYear} need 40% down; {DRIVE_PLAN.minYear} and {DRIVE_PLAN.standardYear - 1} cars need 50%. Autochek does not finance
            older cars. Monthly figures are estimates at Autochek&rsquo;s published ceiling; the lender&rsquo;s offer can be lower.
          </p>
        </div>
      </div>

      <div id={`${inputId}-result`} aria-live="polite" className="surface-card relative overflow-hidden p-6 md:p-8">
        {/* A pool of warm light behind the answer. */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-green-500/15 blur-3xl" />
        {within.length > 0 ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="figures text-brand font-display text-[4.75rem] leading-[0.85] md:text-[6rem]">{within.length}</span>
              <span className="max-w-xs text-lg leading-snug text-text-primary">
                {within.length === 1 ? "vehicle" : "vehicles"} your deposit can drive home
              </span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              On a car from {DRIVE_PLAN.standardYear} or newer, that is enough for a price of up to{" "}
              <span className="figures text-text-primary">{formatNaira(reachNaira * 100)}</span>.{" "}
              {inFull > 0 ? (
                <>
                  <span className="figures">{inFull}</span> of them you could pay for in full.
                </>
              ) : (
                "The most expensive cars you can get with this deposit:"
              )}
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-3 md:gap-4">
              {picks.map((v) => {
                const monthly = monthlyAtCeilingMinor(v.priceMinor - v.depositMinor, DEFAULT_ESTIMATE_MONTHS);
                return (
                  <li key={v.slug}>
                    <Link href={`/vehicles/${v.slug}`} className="group block">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
                        {v.coverUrl && (
                          <VehicleImage
                            src={v.coverUrl}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 18vw, 45vw"
                            className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
                          />
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm text-text-primary group-hover:text-accent-text">{v.title}</p>
                      <p className="figures text-xs text-text-muted">
                        <span className="text-text-secondary">{formatNaira(v.depositMinor)}</span> down ({depositPercentLabel(v.year)})
                      </p>
                      {monthly !== null && (
                        <p className="figures truncate text-xs text-text-muted">
                          est. {formatNaira(monthly)} a month for {DEFAULT_ESTIMATE_MONTHS} months
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border-subtle pt-5">
              {/* The inventory filters on the same rule — each car's own deposit — so "see all" shows exactly these cars. */}
              {within.length > picks.length && (
                <Link href={`/vehicles?maxDeposit=${naira}&sort=price_desc`} className="group inline-flex min-h-11 items-center gap-2 font-semibold text-green-300 hover:text-green-200">
                  See all {within.length} <ArrowRight aria-hidden size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <Link href="/find" className="inline-flex min-h-11 items-center text-sm text-text-secondary hover:text-text-primary">
                Not what you want? Request a car →
              </Link>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center py-6">
            <p className="font-display text-[2rem] leading-tight text-text-primary">
              {naira ? "Nothing in the showroom at that deposit today." : "Enter what you can put down."}
            </p>
            {cheapest && (
              <p className="mt-4 text-text-secondary">
                The lowest deposit in the showroom right now is{" "}
                <button type="button" onClick={() => setText(grouped(Math.ceil(cheapest.depositMinor / 100)))} className="figures text-accent-text underline-offset-4 hover:underline">
                  {formatNaira(cheapest.depositMinor)}
                </button>
                .
              </p>
            )}
            <Link href="/find" className="group mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-green-300 hover:text-green-200">
              Or request the car you want <ArrowRight aria-hidden size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
