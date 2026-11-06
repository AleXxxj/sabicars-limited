import Link from "next/link";
import { BadgeCheck, Ban, Check, FileCheck2, Gift, type LucideIcon } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";
import { formatNaira } from "@/lib/money";
import { commissionMinor, PARTNER_RULES } from "@/lib/referral";
import type { CatalogueItem } from "@/lib/repositories/vehicles";

/**
 * Up to six cars to show what one buyer earns: the Hummer bus first, then a spread from the dearest down, so big
 * and small sales both show. Never two at the same price: two ₦24M buses side by side say the same thing twice.
 */
function earningPicks(vehicles: CatalogueItem[]): CatalogueItem[] {
  const withPhotos = vehicles.filter((v) => v.coverUrl);
  if (!withPhotos.length) return [];
  const byPrice = [...withPhotos].sort((a, b) => b.priceMinor - a.priceMinor);
  const spread = [0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => byPrice[Math.round(q * (byPrice.length - 1))]);
  const picks: CatalogueItem[] = [];
  const take = (v: CatalogueItem | undefined) => {
    if (v && picks.length < 6 && !picks.some((p) => p.slug === v.slug || p.priceMinor === v.priceMinor)) picks.push(v);
  };
  take(withPhotos.find((v) => /hum+er/i.test(v.title)));
  spread.forEach(take);
  byPrice.forEach(take);
  return picks;
}

/**
 * The homepage's hook for earning: cars at the park today and what one buyer
 * for each earns, in a row to swipe, like the cars, so it is plain that every
 * car counts, not one. Three cards from a tablet up, six from 1280px (narrower, six do not fit their amounts).
 * The rules and the full table are on /partners, one tap away.
 */
export function EarningsRow({ vehicles }: { vehicles: CatalogueItem[] }) {
  const picks = earningPicks(vehicles);
  if (!picks.length) return null;
  return (
    <div>
      <p className="text-sm font-medium text-text-muted">What one buyer earns you, on cars at the park today</p>
      <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6 md:[&>li:nth-child(n+4)]:hidden xl:[&>li:nth-child(n+4)]:block [&::-webkit-scrollbar]:hidden">
        {picks.map((v) => (
          <li key={v.slug} className="w-[64%] shrink-0 snap-start sm:w-[42%] md:w-auto">
            <Link href={`/vehicles/${v.slug}`} className="surface-card group flex h-full flex-col overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                <VehicleImage
                  src={v.coverUrl!}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 15vw, (min-width: 768px) 30vw, 64vw"
                  className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="truncate text-sm text-text-primary group-hover:text-accent-text">{v.title}</p>
                <p className="figures text-xs text-text-muted">Sells at {formatNaira(v.priceMinor)}</p>
                <p className="mt-auto pt-3 text-xs text-text-muted">You earn</p>
                {/* Sized to fit the card: ₦360,000 large, ₦10,500,000 (a ₦700M car) a step smaller, never cut off. */}
                <p
                  className={`figures text-brand mt-1 flex min-h-[1.8rem] items-end whitespace-nowrap font-display leading-none ${
                    formatNaira(commissionMinor(v.priceMinor)).length > 9 ? "text-[1.35rem]" : "text-[1.8rem]"
                  }`}
                >
                  {formatNaira(commissionMinor(v.priceMinor))}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
