"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Coins,
  Crown,
  Gauge,
  Package,
  RotateCcw,
  Route,
  TrendingUp,
  Users,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import type { StoryCar } from "./DepositStretch";

export interface QuizCar extends StoryCar {
  body: string | null;
  segment: string;
  make: string;
}

type Use = "work" | "family" | "earn" | "long";
type Priority = "cheap" | "space" | "status" | "value";

const QUESTIONS = [
  {
    key: "use",
    q: "What will the car mostly do?",
    options: [
      { v: "work", label: "Get me to work and around town", icon: Briefcase },
      { v: "family", label: "Family — school runs and weekends", icon: Users },
      { v: "earn", label: "Earn — ride-hailing, hire or staff runs", icon: Coins },
      { v: "long", label: "Long trips between cities", icon: Route },
    ],
  },
  {
    key: "money",
    q: "How much can you put down today?",
    options: [
      { v: "2500000", label: "Under ₦3 million", icon: Wallet },
      { v: "4500000", label: "₦3 – 6 million", icon: Wallet },
      { v: "8000000", label: "₦6 – 10 million", icon: Wallet },
      { v: "15000000", label: "₦10 – 20 million", icon: Wallet },
      { v: "25000000", label: "More than ₦20 million", icon: Wallet },
    ],
  },
  {
    key: "plan",
    q: "Which sounds more like you?",
    options: [
      { v: "cash", label: "Pay once and own it outright", icon: Coins },
      { v: "plan", label: "Drive something better, pay monthly", icon: CalendarClock },
    ],
  },
  {
    key: "priority",
    q: "What matters most?",
    options: [
      { v: "cheap", label: "Cheapest to run and fix", icon: Gauge },
      { v: "space", label: "Room for people and things", icon: Package },
      { v: "status", label: "Comfort, and how it looks", icon: Crown },
      { v: "value", label: "Easy to sell on later", icon: TrendingUp },
    ],
  },
] as const;

type Answers = Partial<Record<(typeof QUESTIONS)[number]["key"], string>>;

function recommend(a: Required<Answers>, cars: QuizCar[]) {
  const use = a.use as Use;
  const priority = a.priority as Priority;
  const money = Number(a.money);
  const plan = a.plan === "plan";
  const reach = plan ? Math.floor(money / 0.4) : money;

  const body: "sedan" | "suv" | "bus" =
    use === "earn" && priority === "space" ? "bus" : use === "family" || use === "long" || priority === "space" ? "suv" : "sedan";
  const kind = { sedan: "a saloon", suv: "an SUV", bus: "a Hiace bus" }[body];
  const headline =
    body === "bus"
      ? "A Toyota Hiace — a bus that earns its keep"
      : priority === "status"
        ? `${kind === "an SUV" ? "An SUV" : "A saloon"} with a premium badge`
        : priority === "value" || priority === "cheap"
          ? `A Toyota ${body === "suv" ? "SUV" : "saloon"}`
          : `${kind[0].toUpperCase()}${kind.slice(1)} with room to spare`;

  const why: string[] = [];
  if (use === "earn")
    why.push(
      body === "bus"
        ? "More seats per trip is more takings per trip."
        : "A saloon is what ride-hailing passengers expect, and it is cheap to keep on the road.",
    );
  if (use === "family") why.push("Height and space make school runs and weekend loads easier.");
  if (use === "long") why.push("On long runs, comfort and ground clearance matter more than anything else.");
  if (use === "work") why.push("For town driving, a saloon is easier to park and lighter on fuel.");
  if (priority === "value" || priority === "cheap")
    why.push("Toyotas have the widest choice of parts and mechanics in Nigeria, and are the easiest to sell on.");
  if (priority === "status") why.push("A premium badge costs more to keep — budget for it as well as for the price.");
  why.push(
    plan
      ? `On the Drive Plan, ${formatNaira(money * 100, { compact: true })} as a 40% deposit reaches a car priced up to ${formatNaira(reach * 100, { compact: true })}.`
      : `In cash, ${formatNaira(money * 100, { compact: true })} buys a car priced up to that.`,
  );

  const pool = cars.filter((c) => c.priceMinor <= reach * 100);
  const shaped = pool.filter((c) => c.body === body || (body === "bus" && /hiace|hum+er/i.test(c.title)));
  const branded =
    priority === "value" || priority === "cheap"
      ? shaped.filter((c) => c.make === "Toyota")
      : priority === "status"
        ? shaped.filter((c) => c.segment === "luxury")
        : [];
  const picks = (branded.length ? branded : shaped).slice(-3).reverse();
  // Cash that reaches nothing: show what the same money reaches as a deposit.
  const alt =
    !plan && !picks.length
      ? cars
          .filter((c) => c.priceMinor <= Math.floor(money / 0.4) * 100 && (c.body === body || body === "bus"))
          .slice(-3)
          .reverse()
      : [];
  // Nothing within reach: the closest car of the right kind, and how far off it is.
  const nearest =
    !picks.length && !alt.length
      ? (cars.find((c) => c.priceMinor > reach * 100 && (c.body === body || (body === "bus" && /hiace|hum+er/i.test(c.title)))) ?? null)
      : null;
  const gap = nearest ? (plan ? Math.ceil(nearest.priceMinor * 0.4) / 100 - money : nearest.priceMinor / 100 - money) : 0;
  return { headline, why, picks, alt, reach, plan, body, nearest, gap };
}

/**
 * Four questions, one answer: what the reader's money should buy them, why,
 * and the cars in the showroom that fit — worked out from their answers and
 * the live stock, not from a generic list.
 */
export function BudgetQuiz({ cars }: { cars: QuizCar[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const done = step >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const result = done ? recommend(answers as Required<Answers>, cars) : null;

  return (
    <div className="surface-card relative overflow-hidden p-5 md:p-10">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${i < step ? "bg-gold-400" : i === step ? "bg-gold-400/50" : "bg-white/10"}`}
            />
          ))}
        </div>
        <p className="figures text-xs text-text-muted">{done ? "Your answer" : `Question ${step + 1} of ${QUESTIONS.length}`}</p>
      </div>

      {!done ? (
        <fieldset key={step} className="mt-6 animate-[prompt-in_var(--duration-base)_var(--ease-out)]">
          <legend className="font-display text-[1.9rem] leading-tight text-text-primary md:text-[2.4rem]">{q.q}</legend>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((o) => {
              const Icon = o.icon;
              const chosen = answers[q.key] === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.key]: o.v }));
                    setStep((s) => s + 1);
                  }}
                  className={`group flex min-h-16 items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background,transform] active:scale-[0.98] ${
                    chosen
                      ? "border-gold-400 bg-gold-500/10"
                      : "border-white/[0.09] bg-white/[0.02] hover:border-gold-500/50 hover:bg-gold-500/[0.05]"
                  }`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500/12 text-gold-300 transition-transform group-hover:scale-110">
                    <Icon aria-hidden size={20} strokeWidth={1.75} />
                  </span>
                  <span className="text-[1rem] text-text-primary">{o.label}</span>
                </button>
              );
            })}
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm text-text-muted hover:text-text-primary"
            >
              <ArrowLeft aria-hidden size={15} /> Back
            </button>
          )}
        </fieldset>
      ) : (
        result && (
          <div className="mt-6 animate-[prompt-in_var(--duration-slow)_var(--ease-out)]" aria-live="polite">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">Our suggestion</p>
            <p className="mt-2 font-display text-[2rem] leading-tight text-text-primary md:text-[2.6rem]">{result.headline}</p>
            <ul className="mt-5 grid gap-2.5">
              {result.why.map((w) => (
                <li key={w} className="flex gap-3 text-[1rem] leading-relaxed text-text-secondary">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold-400" />
                  {w}
                </li>
              ))}
            </ul>

            {result.picks.length > 0 ? (
              <>
                <p className="mt-8 text-sm font-semibold text-text-primary">In the showroom now</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {result.picks.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/vehicles/${c.slug}`}
                      className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-0/60 !no-underline"
                    >
                      <span className="relative block aspect-[4/3] bg-surface-2">
                        {c.coverUrl && (
                          <VehicleImage
                            src={c.coverUrl}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 20vw, 90vw"
                            className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-[1.04]"
                          />
                        )}
                      </span>
                      <span className="block p-3">
                        <span className="block truncate text-sm font-semibold text-text-primary group-hover:text-gold-200">{c.title}</span>
                        <span className="figures block text-xs text-text-secondary">
                          {formatNaira(c.priceMinor)}
                          {result.plan && <span className="text-gold-300"> · {formatNaira(Math.ceil(c.priceMinor * 0.4))} down</span>}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : result.alt.length > 0 ? (
              <div className="mt-8 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4">
                <p className="text-sm text-text-secondary">
                  In cash, this is the older-car market — below anything in the Sabicars showroom today. As a{" "}
                  <span className="text-text-primary">40% Drive Plan deposit</span>, the same money reaches:
                </p>
                <ul className="mt-3 grid gap-1 text-sm">
                  {result.alt.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/vehicles/${c.slug}`}>{c.title}</Link>{" "}
                      <span className="figures text-text-muted">· {formatNaira(Math.ceil(c.priceMinor * 0.4))} down</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : result.nearest ? (
              <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4">
                <span className="relative block aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {result.nearest.coverUrl && (
                    <VehicleImage src={result.nearest.coverUrl} alt="" fill sizes="112px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-sm text-text-secondary">
                  <span className="block text-xs text-text-muted">The closest in the showroom today</span>
                  <Link href={`/vehicles/${result.nearest.slug}`} className="block text-base font-semibold text-text-primary underline-offset-4 hover:underline">
                    {result.nearest.title}
                  </Link>
                  <span className="figures">
                    {result.plan
                      ? `${formatNaira(Math.ceil(result.nearest.priceMinor * 0.4))} down`
                      : formatNaira(result.nearest.priceMinor)}{" "}
                    — <span className="text-text-primary">{formatNaira(Math.max(0, result.gap) * 100)} more</span> than your figure.
                  </span>
                  <span className="mt-2 block">
                    Or{" "}
                    <Link
                      href={`/find?want=${encodeURIComponent(result.body === "bus" ? "Toyota Hiace bus" : result.body === "suv" ? "SUV" : "Toyota saloon")}`}
                    >
                      ask the Sourcing Desk
                    </Link>{" "}
                    to find one within your figure.
                  </span>
                </span>
              </div>
            ) : (
              <p className="mt-8 rounded-2xl border border-white/[0.08] p-4 text-sm text-text-secondary">
                Nothing in the showroom matches exactly today.{" "}
                <Link
                  href={`/find?want=${encodeURIComponent(result.body === "bus" ? "Toyota Hiace bus" : result.body === "suv" ? "SUV" : "Toyota saloon")}`}
                >
                  Put it on the Sourcing Desk
                </Link>{" "}
                and hear the moment one arrives.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={result.plan ? "/drive-plan" : "/vehicles"}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-6 font-semibold text-[#0A0908] !no-underline"
              >
                {result.plan ? "See the Drive Plan" : "Browse the inventory"} <ArrowRight aria-hidden size={17} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setStep(0);
                }}
                className="inline-flex min-h-10 items-center gap-2 text-sm text-text-muted hover:text-text-primary"
              >
                <RotateCcw aria-hidden size={15} /> Start again
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
