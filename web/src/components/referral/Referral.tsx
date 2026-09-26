import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { commissionMinor, PARTNER_RULES } from "@/lib/referral";
import type { CatalogueItem } from "@/lib/repositories/vehicles";

/**
 * What 1.5% means in naira, shown on real vehicles in stock today — a low,
 * middle and high price — rather than round numbers someone made up.
 */
export function EarningsExamples({ vehicles }: { vehicles: CatalogueItem[] }) {
  const picks = [0.2, 0.6, 0.92].map((q) => vehicles[Math.min(vehicles.length - 1, Math.floor(vehicles.length * q))]).filter(Boolean);
  const unique = [...new Map(picks.map((p) => [p.slug, p])).values()];
  if (!unique.length) return null;

  return (
    <div className="border border-border-default bg-surface-0">
      <p className="eyebrow border-b border-border-subtle px-6 py-4 !text-text-muted md:px-8">What 1.5% looks like, on cars in stock today</p>
      <ul className="divide-y divide-border-subtle">
        {unique.map((v) => (
          <li key={v.slug}>
            <Link href={`/vehicles/${v.slug}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 px-6 py-5 md:px-8">
              <span className="truncate text-text-primary group-hover:text-accent-text">{v.title}</span>
              <span className="figures row-span-2 text-right font-display text-[1.9rem] leading-none text-accent-text">
                {formatNaira(commissionMinor(v.priceMinor))}
              </span>
              <span className="figures text-sm text-text-muted">If they buy it at {formatNaira(v.priceMinor)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-border-subtle px-6 py-4 text-sm text-text-secondary md:px-8">
        Fleet orders count in full: on a <span className="figures">₦100,000,000</span> order, 1.5% is{" "}
        <span className="figures text-text-primary">{formatNaira(commissionMinor(100_000_000 * 100))}</span>.
      </p>
    </div>
  );
}

/** The four promises that make this a sales commission and nothing else. */
export function PartnerRules() {
  return (
    <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
      {PARTNER_RULES.map(([rule, text], i) => (
        <li key={rule} className="border-t border-gold-700 pt-5">
          <p className="figures text-xs text-text-muted">0{i + 1}</p>
          <p className="mt-2 font-display text-[1.6rem] leading-tight">{rule}</p>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</p>
        </li>
      ))}
    </ol>
  );
}
