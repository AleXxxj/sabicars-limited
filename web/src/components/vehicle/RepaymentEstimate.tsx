"use client";

import { useState } from "react";
import { DEFAULT_ESTIMATE_MONTHS, ESTIMATE_MONTHS, ESTIMATE_NOTE, monthlyAtCeilingMinor, type EstimateMonths } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";

/**
 * The estimated monthly repayment on a financed balance, at the term the
 * buyer picks. Every figure is an estimate at Autochek's published ceiling
 * and says so beneath itself: the lender's offer is the only quote.
 */
export function RepaymentEstimate({ balanceMinor, size = "card" }: { balanceMinor: number; size?: "card" | "hero" }) {
  const [months, setMonths] = useState<EstimateMonths>(DEFAULT_ESTIMATE_MONTHS);
  const monthly = monthlyAtCeilingMinor(balanceMinor, months);
  if (monthly === null) return null;

  return (
    <div>
      <p className="text-xs text-text-muted">Estimated monthly repayment</p>
      <p aria-live="polite" className={`figures mt-1 ${size === "hero" ? "font-display text-[1.9rem] leading-none text-text-primary" : "text-lg font-semibold text-text-primary"}`}>
        {formatNaira(monthly)}{" "}
        <span className={`font-sans font-normal text-text-muted ${size === "hero" ? "text-sm" : "text-xs"}`}>a month for {months} months</span>
      </p>
      <div role="radiogroup" aria-label="Repayment term" className="mt-3 flex flex-wrap gap-2">
        {ESTIMATE_MONTHS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={months === m}
            onClick={() => setMonths(m)}
            className="figures min-h-9 rounded-full border border-border-default px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary aria-checked:border-green-400 aria-checked:bg-green-500/15 aria-checked:text-green-100"
          >
            {m} months
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">{ESTIMATE_NOTE}</p>
    </div>
  );
}
