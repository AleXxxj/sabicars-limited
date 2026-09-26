"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { useInView, useWidth } from "./motion";

export interface ChartBus {
  slug: string;
  title: string;
  year: number;
  priceMinor: number;
  seats: number | null;
}

/**
 * Every Hummer bus in the showroom today, placed by year and price — what a
 * newer bus costs, at a glance. Drawn from live stock, so it is never out of
 * date; each dot opens its bus.
 */
export function StockChart({ buses }: { buses: ChartBus[] }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const [box, width] = useWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<string | null>(null);
  if (buses.length < 2) return null;

  const years = buses.map((b) => b.year);
  const prices = buses.map((b) => b.priceMinor);
  const y0 = Math.min(...years) - 1;
  const y1 = Math.max(...years) + 1;
  // Round the price axis to whole ₦5m steps around the stock.
  const step = 500_000_000;
  const p0 = Math.floor(Math.min(...prices) / step) * step - step;
  const p1 = Math.ceil(Math.max(...prices) / step) * step + step;

  // Drawn in real pixels at whatever width it is given, so labels stay readable on a phone.
  const W = Math.max(280, width);
  const narrow = W < 520;
  const H = narrow ? 250 : 320;
  const pad = { l: narrow ? 48 : 64, r: narrow ? 14 : 24, t: 16, b: 40 };
  const x = (yr: number) => pad.l + ((yr - y0) / (y1 - y0)) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - (p - p0) / (p1 - p0)) * (H - pad.t - pad.b);
  const ticksP = Array.from({ length: Math.round((p1 - p0) / step) + 1 }, (_, i) => p0 + i * step);
  const ticksY = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).filter(
    (yr) => yr > y0 && yr < y1 && (!narrow || (yr - y0) % 2 === 1),
  );
  const active = buses.find((b) => b.slug === hover);

  return (
    <div ref={ref} className="surface-card p-4 sm:p-6 md:p-8">
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hummer buses in stock by year and price" className="w-full overflow-visible">
          {ticksP.map((p) => (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="rgb(255 255 255 / 0.06)" />
              <text
                x={pad.l - 10}
                y={y(p) + 4}
                textAnchor="end"
                fontSize="12"
                fill="var(--text-muted)"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {formatNaira(p, { compact: true })}
              </text>
            </g>
          ))}
          {ticksY.map((yr) => (
            <text
              key={yr}
              x={x(yr)}
              y={H - pad.b + 24}
              textAnchor="middle"
              fontSize="12"
              fill="var(--text-muted)"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {yr}
            </text>
          ))}
          {buses.map((b, i) => {
            const on = hover === b.slug;
            return (
              <Link key={b.slug} href={`/vehicles/${b.slug}`} aria-label={`${b.title}, ${formatNaira(b.priceMinor)}`}>
                <circle
                  cx={x(b.year) + ((i % 3) - 1) * 10}
                  cy={y(b.priceMinor)}
                  r={on ? 12 : 9}
                  fill={on ? "var(--gold-300)" : "var(--gold-500)"}
                  stroke="#0A0908"
                  strokeWidth="3"
                  onMouseEnter={() => setHover(b.slug)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(b.slug)}
                  style={{
                    opacity: seen ? 1 : 0,
                    transform: seen ? "none" : "translateY(40px)",
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transition: `opacity 500ms ease ${i * 130}ms, transform 700ms cubic-bezier(0.34,1.56,0.64,1) ${i * 130}ms, r 200ms ease`,
                    cursor: "pointer",
                  }}
                />
              </Link>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 min-h-12 text-sm text-text-secondary" aria-live="polite">
        {active ? (
          <>
            <span className="text-text-primary">{active.title}</span> · <span className="figures">{formatNaira(active.priceMinor)}</span>
            {active.seats ? ` · ${active.seats} seats` : ""} — tap to open it.
          </>
        ) : (
          `${buses.length} Hummer buses in the showroom today, from ${Math.min(...years)} to ${Math.max(...years)}. Point at one for its price.`
        )}
      </p>
    </div>
  );
}
