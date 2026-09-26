"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { formatNaira, money, percentOf, subtract } from "@/lib/money";
import { DRIVE_PLAN_DEPOSIT_BPS } from "@/lib/vehicle";
import type { FinderVehicle } from "./DrivePlanFinder";

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Any price, split: what you pay and what Autochek finances. For a car seen
 * elsewhere, a figure someone quoted, or one in stock. No monthly figure is
 * shown — Autochek sets the tenor and rate on each listing, and a guess here
 * would be a promise Sabicars cannot keep.
 */
export function PriceSplit({ vehicles }: { vehicles: FinderVehicle[] }) {
  const id = useId();
  const [text, setText] = useState(
    vehicles[Math.floor(vehicles.length / 2)] ? grouped(Math.round(vehicles[Math.floor(vehicles.length / 2)].priceMinor / 100)) : "",
  );
  const [slug, setSlug] = useState("");
  const naira = Number(text.replace(/\D/g, "")) || 0;
  const price = money(naira * 100, "NGN");
  const deposit = percentOf(price, DRIVE_PLAN_DEPOSIT_BPS);
  const financed = subtract(price, deposit);
  const chosen = vehicles.find((v) => v.slug === slug);

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
            if (v) setText(grouped(Math.round(v.priceMinor / 100)));
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-border-default bg-surface-1 px-4 text-text-primary outline-none focus:border-gold-500"
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
        <div className="mt-2 flex items-baseline gap-2 border-b border-border-strong pb-2 transition-colors focus-within:border-gold-500">
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
      </div>

      <dl aria-live="polite" className="grid content-center gap-5 md:border-l md:border-white/[0.06] md:pl-8">
        <div>
          <dt className="text-sm text-text-muted">You pay (40%)</dt>
          <dd className="figures text-gold mt-1 font-display text-[2.6rem] leading-none md:text-[3.2rem]">
            {naira ? formatNaira(deposit.minor) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Autochek finances (60%), once it approves</dt>
          <dd className="figures mt-1 font-display text-[1.9rem] leading-none text-text-primary">
            {naira ? formatNaira(financed.minor) : "—"}
          </dd>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary">
          Autochek sets the repayment terms on each listing. The vehicle leaves the showroom once Autochek approves and the 40% is paid.
        </p>
        {chosen && (
          <Link href={`/vehicles/${chosen.slug}#drive-plan`} className="text-sm font-semibold text-gold-300 hover:text-gold-200">
            Apply for the {chosen.title} →
          </Link>
        )}
      </dl>
    </div>
  );
}
