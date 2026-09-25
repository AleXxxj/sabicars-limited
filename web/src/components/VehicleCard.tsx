import Link from "next/link";
import type { VehicleWithCover } from "@/lib/repositories/vehicles";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { VehicleImage } from "@/components/VehicleImage";
import { badgeFor, drivePlanDeposit, priceLabel, specLine } from "@/lib/vehicle";

/**
 * A vehicle as it appears in a grid.
 *
 * Deliberately has no WhatsApp or call button. The whole card is one link to
 * the vehicle's page, where the buyer can reserve, book a viewing or ask —
 * and every one of those is recorded. The legacy card sent people straight to
 * one phone from every tile in every grid.
 */
export function VehicleCard({
  vehicle: v,
  href,
  priority = false,
}: {
  vehicle: VehicleWithCover;
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
        {badge && (
          // Sits on a photograph, so it takes the dark photographic treatment in
          // both themes — a white chip with gold text is unreadable on light.
          <span className="eyebrow absolute left-4 top-4 bg-[#0B0A09]/80 px-3 py-1.5 !text-[0.62rem] !tracking-[0.2em] !text-gold-300 backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <p className="eyebrow !text-[0.66rem]">
            {v.make} · {v.year}
          </p>
          <h3 className="mt-2 text-[1.9rem] leading-[1.05] text-text-primary">{v.model}</h3>
          {spec && <p className="mt-2 text-sm text-text-muted">{spec}</p>}
        </div>

        <div className="mt-auto border-t border-border-subtle pt-4">
          <p className="figures text-xl font-semibold tracking-tight text-text-primary">{priceLabel(v)}</p>
          {deposit && (
            <p className="mt-1 text-[0.82rem] text-text-secondary">
              <span className="figures text-accent-text">{deposit}</span> today on the 40% Drive Plan
            </p>
          )}
        </div>
      </div>
    </>
  );

  const shell =
    "group flex h-full flex-col overflow-hidden border border-border-subtle bg-surface-1 transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-border-default hover:shadow-[var(--shadow-lg)]";

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <article className={shell}>{body}</article>
  );
}
