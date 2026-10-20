"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { DRIVE_PLAN, depositMinorFor, drivePlanTerms } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";
import type { FinderVehicle } from "./DrivePlanFinder";

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The two tiers a buyer can choose between for a price typed by hand; a car chosen from stock sets its own. */
const TIERS = [
  { year: DRIVE_PLAN.standardYear, label: `${DRIVE_PLAN.standardYear} or newer`, deposit: "40% down" },
  { year: DRIVE_PLAN.minYear, label: `${DRIVE_PLAN.minYear}–${DRIVE_PLAN.standardYear - 1}`, deposit: "50% down" },
] as const;

/**
 * Any price, split: what you pay and what Autochek finances, at the deposit
 * the car's model year carries. For a car seen elsewhere, a figure someone
 * quoted, or one in stock. No monthly figure is shown — Autochek's lender sets
 * the tenure and rate when it assesses the buyer, and a guess here would be a
 * promise Sabicars cannot keep.
 */
export function PriceSplit({ vehicles }: { vehicles: FinderVehicle[] }) {
  const id = useId();
  const middle = vehicles[Math.floor(vehicles.length / 2)];
  const [text, setText] = useState(middle ? grouped(Math.round(middle.priceMinor / 100)) : "");
  const [slug, setSlug] = useState("");
  const [tierYear, setTierYear] = useState<number>(middle?.year ?? DRIVE_PLAN.standardYear);
  const naira = Number(text.replace(/\D/g, "")) || 0;
  const priceMinor = naira * 100;
  const terms = drivePlanTerms(tierYear);
  // The same whole-naira rounding as every car page, so the two halves shown here always add up to the price.
  const depositMinor = terms.eligible ? (depositMinorFor(priceMinor, tierYear) ?? 0) : 0;
  const financedMinor = priceMinor - depositMinor;
  const chosen = vehicles.find((v) => v.slug === slug);
  const tier = TIERS.find((t) => tierYear >= t.year) ?? TIERS[0];

  return (
    <div className="surface-card grid gap-8 p-6 md:grid-cols-2 md:p-10">
      <div>
        <p className="text-sm font-medium text-text-muted">Any price, split</p>
        <label htmlFor={`${id}-car`} className="mt-5 block text-sm text-text-secondary">
          A vehicle in the showroom
        </label>
        <select
          id={`${id}-car`}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            const v = vehicles.find((x) => x.slug === e.target.value);
            if (v) {
              setText(grouped(Math.round(v.priceMinor / 100)));
              setTierYear(v.year);
            }
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-border-default bg-surface-1 px-4 text-text-primary outline-none focus:border-green-500"
        >
          <option value="">Choose one, or type any price below</option>
          {vehicles.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.title} — {formatNaira(v.priceMinor)}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-price`} className="mt-6 block text-sm text-text-secondary">
          Price of the vehicle
        </label>
        <div className="mt-2 flex items-baseline gap-2 border-b border-border-strong pb-2 transition-colors focus-within:border-green-500">
          <span aria-hidden className="font-display text-[2rem] leading-none text-text-muted">
            ₦
          </span>
          <input
            id={`${id}-price`}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
              setText(digits ? grouped(Number(digits)) : "");
              setSlug("");
            }}
            placeholder="0"
            className="figures w-full min-w-0 bg-transparent font-display text-[2rem] leading-none text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <p className="mt-6 text-sm text-text-secondary">The car&rsquo;s model year</p>
        <div role="radiogroup" aria-label="The car's model year" className="mt-2 flex flex-wrap gap-2">
          {TIERS.map((t) => {
            const on = tier.year === t.year;
            return (
              <button
                key={t.year}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setTierYear(t.year);
                  setSlug("");
                }}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  on ? "border-green-400 bg-green-500/15 text-green-100" : "border-border-default text-text-secondary hover:border-border-strong"
                }`}
              >
                {t.label} · {t.deposit}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted">Autochek does not finance cars older than {DRIVE_PLAN.minYear}.</p>
      </div>

      <dl aria-live="polite" className="grid content-center gap-5 md:border-l md:border-white/[0.06] md:pl-8">
        <div>
          <dt className="text-sm text-text-muted">You pay ({terms.eligible ? `${terms.depositPercent}%` : "—"})</dt>
          <dd className="figures text-brand mt-1 font-display text-[2.6rem] leading-none md:text-[3.2rem]">
            {naira && terms.eligible ? formatNaira(depositMinor) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Autochek finances ({terms.eligible ? `${terms.financedPercent}%` : "—"}), once it approves</dt>
          <dd className="figures mt-1 font-display text-[1.9rem] leading-none text-text-primary">
            {naira && terms.eligible ? formatNaira(financedMinor) : "—"}
          </dd>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">
          Autochek&rsquo;s lender sets the repayment terms when it assesses you: up to {DRIVE_PLAN.maxAnnualRatePercent}% a year, over{" "}
          {DRIVE_PLAN.tenureMonths.min} to {DRIVE_PLAN.tenureMonths.max} months. The vehicle leaves the showroom once Autochek approves and the
          deposit is paid.
        </p>
        {chosen && (
          <Link href={`/vehicles/${chosen.slug}#drive-plan`} className="text-sm font-semibold text-green-300 hover:text-green-200">
            Apply for the {chosen.title} →
          </Link>
        )}
      </dl>
    </div>
  );
}
