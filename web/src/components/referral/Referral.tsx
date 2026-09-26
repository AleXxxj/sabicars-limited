import Link from "next/link";
import { BadgeCheck, Ban, FileCheck2, Gift, type LucideIcon } from "lucide-react";
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
    <div className="surface-card overflow-hidden">
      <p className="border-b border-white/[0.06] px-6 py-4 text-sm font-medium text-text-muted md:px-8">What 1.5% looks like, on cars in stock today</p>
      <ul className="divide-y divide-white/[0.06]">
        {unique.map((v) => (
          <li key={v.slug}>
            <Link href={`/vehicles/${v.slug}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 px-6 py-5 md:px-8">
              <span className="truncate text-text-primary group-hover:text-accent-text">{v.title}</span>
              <span className="figures text-gold row-span-2 text-right font-display text-[2rem] leading-none">
                {formatNaira(commissionMinor(v.priceMinor))}
              </span>
              <span className="figures text-sm text-text-muted">If they buy it at {formatNaira(v.priceMinor)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-white/[0.06] bg-white/[0.02] px-6 py-4 text-sm text-text-secondary md:px-8">
        Fleet orders count in full: on a <span className="figures">₦100,000,000</span> order, 1.5% is{" "}
        <span className="figures text-text-primary">{formatNaira(commissionMinor(100_000_000 * 100))}</span>.
      </p>
    </div>
  );
}

const RULE_ICONS: LucideIcon[] = [Gift, BadgeCheck, Ban, FileCheck2];

/** The four promises that make this a sales commission and nothing else. */
export function PartnerRules() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PARTNER_RULES.map(([rule, text], i) => {
        const Icon = RULE_ICONS[i];
        return (
          <li key={rule} className="surface-card p-6">
            <span className="inline-flex size-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
              <Icon aria-hidden size={20} strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-[1.1rem] font-semibold leading-snug text-text-primary">{rule}</p>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
          </li>
        );
      })}
    </ol>
  );
}
