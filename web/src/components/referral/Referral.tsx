import Link from "next/link";
import { BadgeCheck, Ban, Check, FileCheck2, Gift, type LucideIcon } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import { commissionMinor, PARTNER_RULES } from "@/lib/referral";
import type { CatalogueItem } from "@/lib/repositories/vehicles";

/**
 * The homepage's hook for Refer & Earn: one real car in stock and what one
 * buyer for it would earn, in a number big enough to stop a scroll. The rules
 * and more examples are on /partners, one tap away, for whoever is curious.
 * The Hummer bus leads when one is in stock: it is what Sabicars is known for.
 */
export function EarningsHook({ vehicles }: { vehicles: CatalogueItem[] }) {
  const pick = vehicles.find((v) => /hum+er/i.test(v.title) && v.coverUrl) ?? vehicles.filter((v) => v.coverUrl)[Math.floor(vehicles.filter((v) => v.coverUrl).length / 2)];
  if (!pick) return null;
  return (
    <Link href={`/vehicles/${pick.slug}`} className="surface-card group block overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        <VehicleImage
          src={pick.coverUrl!}
          alt=""
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-6 md:p-8">
        <p className="text-sm text-text-secondary">
          Send a buyer for this <span className="text-text-primary">{pick.title}</span> at <span className="figures text-text-primary">{formatNaira(pick.priceMinor)}</span>.
        </p>
        <p className="mt-3 text-sm text-text-muted">You earn</p>
        <p className="figures text-brand mt-1 font-display text-[3rem] leading-none md:text-[3.6rem]">{formatNaira(commissionMinor(pick.priceMinor))}</p>
      </div>
    </Link>
  );
}

/** The three promises, in a line each, for the homepage: what makes this a commission and never a scheme. The rules in full are on /partners. */
export function PartnerPromises({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem] text-text-secondary ${className}`}>
      {["Free to join", "Paid when they buy", "No recruiting"].map((p) => (
        <li key={p} className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={16} strokeWidth={2.4} className="shrink-0 text-green-300" />
          {p}
        </li>
      ))}
    </ul>
  );
}

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
              <span className="figures text-brand row-span-2 text-right font-display text-[2rem] leading-none">
                {formatNaira(commissionMinor(v.priceMinor))}
              </span>
              <span className="figures text-sm text-text-muted">If they buy it at {formatNaira(v.priceMinor)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-white/[0.06] bg-white/[0.02] px-6 py-4 text-sm text-text-secondary md:px-8">
        Bulk orders count in full: on a <span className="figures">₦100,000,000</span> order, 1.5% is{" "}
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
            <span className="inline-flex size-11 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10 text-green-300">
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
