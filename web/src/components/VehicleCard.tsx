import Link from "next/link";
import { Gauge, Wallet } from "lucide-react";
import type { CardVehicle } from "@/lib/repositories/vehicles";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { VehicleImage } from "@/components/VehicleImage";
import { SaveButton } from "@/components/saved/SaveButton";
import { badgeFor, drivePlanDeposit, priceLabel, specLine } from "@/lib/vehicle";

/**
 * A vehicle as it appears in a grid.
 *
 * Deliberately has no WhatsApp or call button. The whole card is one link to
 * the vehicle's page, where the buyer can reserve, book a viewing or ask —
 * and every one of those is recorded. The legacy card sent people straight to
 * one phone from every tile in every grid. The only other control is the
 * heart, which keeps the car on the visitor's shortlist.
 *
 * Read in the order a buyer scans: the car, the price, what it takes to drive
 * it home. Model names are set in the sans, not the display serif — a name
 * has to be read at a glance, not admired.
 */
export function VehicleCard({
  vehicle: v,
  href,
  priority = false,
}: {
  vehicle: CardVehicle;
  /** Omit to render the card without a link (e.g. in the design reference). */
  href?: string;
  /** True for cards visible without scrolling, so the browser fetches them first. */
  priority?: boolean;
}) {
  const badge = badgeFor(v);
  const deposit = drivePlanDeposit(v);
  const spec = specLine(v);

  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <VehicleImage
          src={v.cover?.url ?? VEHICLE_PLACEHOLDER}
          alt={v.cover?.alt ?? `${v.year} ${v.make} ${v.model}`}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
        {/* Lets the photo sink into the card instead of ending on a hard line. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0A0908]/55 to-transparent" />
        {badge && (
          <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] text-gold-200">{badge}</span>
        )}
        {href && <SaveButton slug={v.slug} title={`${v.year} ${v.make} ${v.model}`} className="absolute right-3 top-3 z-[2]" />}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <p className="text-[0.8rem] font-medium text-text-muted">
            {v.year} · {v.make}
          </p>
          <h3 className="mt-1 truncate font-sans text-[1.3rem] font-semibold leading-snug tracking-[-0.01em] text-text-primary">{v.model}</h3>
          {spec && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-text-muted">
              <Gauge aria-hidden size={15} className="shrink-0 opacity-70" />
              <span className="truncate">{spec}</span>
            </p>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="figures text-[1.35rem] font-semibold leading-none tracking-tight text-text-primary">{priceLabel(v)}</p>
          {deposit && (
            <p className="flex items-center gap-1.5 text-right text-[0.8rem] leading-tight text-text-secondary">
              <Wallet aria-hidden size={15} className="shrink-0 text-accent-text" />
              <span>
                <span className="figures block font-semibold text-accent-text">{deposit}</span>
                40% deposit
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  );

  const shell =
    "surface-card group flex h-full flex-col overflow-hidden transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] " +
    "hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_30px_70px_-30px_rgb(0_0_0/0.9)]";

  // The whole card is the link (stretched over it), with the heart above it —
  // a button cannot sit inside a link.
  return (
    <article className={`relative ${shell}`}>
      {href && <Link href={href} aria-label={`${v.year} ${v.make} ${v.model}, ${priceLabel(v)}`} className="absolute inset-0 z-[1] rounded-[1.25rem]" />}
      {body}
    </article>
  );
}
