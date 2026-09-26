"use client";

import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { useCountUp, useInView } from "./motion";

const STEPS = ["Choose the bus", "Apply on Autochek", "Autochek approves", "Pay your 40% and drive"];

/**
 * The Drive Plan on a real bus from the showroom: the price splits into the
 * 40% the buyer pays and the 60% Autochek finances, the figures counting up
 * as the bar fills, then the four steps light up in order.
 */
export function DrivePlanSplit({ car }: { car: { title: string; slug: string; priceMinor: number; depositMinor: number } | null }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const deposit = useCountUp(car ? Math.round(car.depositMinor / 100) : 0, seen, 1600);
  const financed = useCountUp(car ? Math.round((car.priceMinor - car.depositMinor) / 100) : 0, seen, 2000);
  if (!car) return null;

  return (
    <div ref={ref} className="surface-card relative overflow-hidden p-6 md:p-10">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold-500/15 blur-3xl" />
      <p className="text-sm text-text-muted">
        On the{" "}
        <Link href={`/vehicles/${car.slug}`} className="text-text-primary underline-offset-4 hover:underline">
          {car.title}
        </Link>
        , priced at <span className="figures text-text-primary">{formatNaira(car.priceMinor)}</span>
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-[2fr_3fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-300 uppercase">You pay · 40%</p>
          <p className="figures text-gold mt-2 font-display text-[2.6rem] leading-none md:text-[3.4rem]">
            ₦{deposit.toLocaleString("en-NG")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-text-muted uppercase">Autochek finances · 60%</p>
          <p className="figures mt-2 font-display text-[2.2rem] leading-none text-text-primary md:text-[2.8rem]">
            ₦{financed.toLocaleString("en-NG")}
          </p>
        </div>
      </div>

      {/* The bar: 40% fills gold, then the 60% draws in beside it. */}
      <div
        role="img"
        aria-label="40% paid by you, 60% financed by Autochek"
        className="mt-8 flex h-4 overflow-hidden rounded-full bg-white/[0.05]"
      >
        <div
          className="h-full rounded-l-full bg-[linear-gradient(90deg,var(--gold-500),var(--gold-300))] shadow-[0_0_24px_rgb(201_168_76/0.5)]"
          style={{ width: seen ? "40%" : "0%", transition: "width 1600ms cubic-bezier(0.16,1,0.3,1)" }}
        />
        <div
          className="h-full border-y border-r border-dashed border-white/30"
          style={{ width: seen ? "60%" : "0%", transition: "width 1400ms cubic-bezier(0.16,1,0.3,1) 700ms" }}
        />
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="relative border-t-2 pt-4 text-sm"
            style={{
              borderColor: seen ? "var(--gold-400)" : "rgb(255 255 255 / 0.1)",
              color: seen ? "var(--text-primary)" : "var(--text-muted)",
              transition: `border-color 500ms ease ${1800 + i * 450}ms, color 500ms ease ${1800 + i * 450}ms`,
            }}
          >
            <span className="figures block text-xs text-text-muted">0{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs leading-relaxed text-text-muted">
        Autochek sets the repayment terms on its listing and decides the approval. The bus leaves the showroom once it approves and the 40%
        is paid.
      </p>
    </div>
  );
}
