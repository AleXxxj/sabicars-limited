"use client";

import { useId, useState } from "react";
import { formatNaira } from "@/lib/money";
import { useInView, useTween } from "./motion";

const grouped = (n: number) => (n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "");
const digits = (s: string) => Number(s.replace(/\D/g, "").slice(0, 10)) || 0;
const PAY = [150_000, 300_000, 500_000, 1_000_000, 2_000_000];

/** The rule of thumb: a car repayment within 30% of take-home pay leaves room for everything else. */
const COMFORT = 0.3;
const STRETCH = 0.4;

/**
 * "Can I carry it?" The reader's pay sets a comfortable ceiling for the
 * monthly repayment, drawn as a gold arc; the figure Autochek quotes them is
 * drawn over it, and the verdict is plain: comfortable, a stretch, or too heavy.
 */
export function RepaymentComfort() {
  const id = useId();
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const [pay, setPay] = useState("500,000");
  const [quote, setQuote] = useState("");
  const income = digits(pay);
  const quoted = digits(quote);
  const ceiling = Math.round(income * COMFORT);
  const share = income ? quoted / income : 0;

  const ceilingShown = useTween(seen ? ceiling : 0, 900);
  const comfortArc = useTween(seen ? COMFORT : 0, 1100);
  const quoteArc = useTween(seen ? Math.min(share, 1) : 0, 700);

  const r = 70;
  const c = 2 * Math.PI * r;
  const verdict = !quoted
    ? null
    : share <= COMFORT
      ? {
          tone: "text-success",
          ring: "var(--success)",
          text: `Comfortable. You keep ${formatNaira((income - quoted) * 100)} a month for everything else.`,
        }
      : share <= STRETCH
        ? {
            tone: "text-accent-text",
            ring: "var(--gold-300)",
            text: "A stretch. Possible — but it leaves little room for fuel, insurance and the unexpected.",
          }
        : {
            tone: "text-danger",
            ring: "var(--danger)",
            text: "Too heavy. Look at a cheaper car, a bigger deposit, or a longer term with Autochek.",
          };

  return (
    <div ref={ref} className="surface-card grid items-center gap-8 p-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-10">
      <div className="relative mx-auto aspect-square w-full max-w-[17rem]">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden>
          <circle cx="90" cy="90" r={r} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="16" />
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke="var(--gold-400)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - comfortArc)}
            opacity="0.9"
            style={{ filter: "drop-shadow(0 0 8px rgb(201 168 76 / 0.5))" }}
          />
          {quoted > 0 && (
            <circle
              cx="90"
              cy="90"
              r={r - 20}
              fill="none"
              stroke={verdict?.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (r - 20)}
              strokeDashoffset={2 * Math.PI * (r - 20) * (1 - quoteArc)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-text-muted">Keep the repayment under</span>
          <span className="figures text-gold mt-1 font-display text-[2rem] leading-none">
            {formatNaira(Math.round(ceilingShown) * 100, { compact: ceiling >= 10_000_000 })}
          </span>
          <span className="mt-1 text-xs text-text-muted">a month</span>
        </div>
      </div>

      <div className="grid gap-5">
        <label htmlFor={`${id}-pay`} className="grid gap-2">
          <span className="text-sm text-text-secondary">Your take-home pay, a month</span>
          <span className="flex items-baseline gap-2 border-b border-border-strong pb-1.5 focus-within:border-gold-500">
            <span aria-hidden className="font-display text-2xl text-text-muted">
              ₦
            </span>
            <input
              id={`${id}-pay`}
              inputMode="numeric"
              value={pay}
              onChange={(e) => setPay(grouped(digits(e.target.value)))}
              className="figures w-full min-w-0 bg-transparent font-display text-2xl text-text-primary outline-none"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PAY.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPay(grouped(p))}
              aria-pressed={income === p}
              className="figures min-h-9 rounded-full border border-border-default px-3.5 text-xs text-text-secondary hover:border-border-strong aria-pressed:border-gold-500 aria-pressed:bg-gold-500/10 aria-pressed:text-gold-200"
            >
              {formatNaira(p * 100, { compact: true })}
            </button>
          ))}
        </div>
        <label htmlFor={`${id}-quote`} className="grid gap-2">
          <span className="text-sm text-text-secondary">The monthly repayment Autochek quoted you (optional)</span>
          <span className="flex items-baseline gap-2 border-b border-border-strong pb-1.5 focus-within:border-gold-500">
            <span aria-hidden className="font-display text-2xl text-text-muted">
              ₦
            </span>
            <input
              id={`${id}-quote`}
              inputMode="numeric"
              placeholder="0"
              value={quote}
              onChange={(e) => setQuote(grouped(digits(e.target.value)))}
              className="figures w-full min-w-0 bg-transparent font-display text-2xl text-text-primary outline-none placeholder:text-text-muted"
            />
          </span>
        </label>
        <p role="status" className={`min-h-12 text-[0.98rem] leading-relaxed ${verdict ? verdict.tone : "text-text-muted"}`}>
          {verdict ? (
            <>
              <span className="figures font-semibold">{Math.round(share * 100)}% of your pay.</span> {verdict.text}
            </>
          ) : (
            "Enter a quote to see how it sits against your pay."
          )}
        </p>
        <p className="text-xs leading-relaxed text-text-muted">
          A rule of thumb, not a rule: insurance, fuel and servicing come on top of the repayment.
        </p>
      </div>
    </div>
  );
}
