import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarClock, RotateCcw, Users } from "lucide-react";
import { ReserveForm } from "@/components/reserve/ReserveForm";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleImage } from "@/components/VehicleImage";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { formatNaira } from "@/lib/money";
import { vehicleBySlug } from "@/lib/repositories/vehicles";
import { reserveQuote } from "@/lib/reserve";
import { holdLabel, LONG_HOLD_DAYS, MIN_DEPOSIT_MINOR, REFUND_CHARGE_BPS, SHORT_HOLD_DAYS } from "@/lib/reservations";
import { site } from "@/lib/site";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

type Props = { params: Promise<{ slug: string }> };

/** Always fresh: whether another buyer is holding the car is decided now, not at build time. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await vehicleBySlug((await params).slug);
  return { title: found ? `Reserve the ${vehicleTitle(found.vehicle)}` : "Reserve a car", robots: { index: false, follow: false } };
}

const RULES = [
  [CalendarClock, `${formatNaira(MIN_DEPOSIT_MINOR)} holds the car for ${holdLabel(SHORT_HOLD_DAYS)}. 40% of the price or more holds it for ${holdLabel(LONG_HOLD_DAYS)}.`],
  [Users, "One buyer at a time. While your deposit holds the car, nobody else can reserve it, online or at the showroom."],
  [RotateCcw, `Change your mind and the deposit comes back, less ${REFUND_CHARGE_BPS / 100}% for holding the money, tax and bank charges.`],
  [BadgeCheck, `Sold by ${site.legalName}, CAC RC ${site.rcNumber}. Every deposit has a reference and a receipt.`],
] as const;

/**
 * Reserve a car with a deposit. One page, with the car in view, the rules
 * in plain words, and the amounts the policy allows; the payment itself
 * happens on Paystack's page, and the buyer comes back to /reserve/done.
 */
export default async function ReservePage({ params }: Props) {
  const found = await vehicleBySlug((await params).slug);
  if (!found) notFound();
  const { vehicle: v, media } = found;
  const title = vehicleTitle(v);
  const cover = media.find((m) => m.kind === "photo")?.url ?? VEHICLE_PLACEHOLDER;
  const quote = await reserveQuote(v);

  return (
    <article className="mx-auto max-w-5xl px-5 pt-6 pb-20 md:px-10 md:pt-10">
      <Link href={`/vehicles/${v.slug}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft aria-hidden size={16} /> Back to the {v.model}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-14">
        <div>
          <p className="kicker">Reserve this car</p>
          <h1 className="mt-3 text-display-3">{title}</h1>
          <p className="figures mt-2 text-2xl font-semibold">{priceLabel(v)}</p>
          <div className="relative mt-6 aspect-[4/3] overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
            <VehicleImage src={cover} alt={`${title} for sale in Lagos`} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
          </div>
          <ul className="mt-8 grid gap-4">
            {RULES.map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                <Icon aria-hidden size={18} className="mt-0.5 shrink-0 text-green-300" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          {quote.blocked === "reserved" ? (
            <div className="surface-card p-7 md:p-9">
              <p className="kicker">Reserved</p>
              <h2 className="mt-3 text-display-3">Another buyer is holding this car.</h2>
              <p className="mt-4 text-text-secondary">If their hold runs out, it comes back on offer. Ask us to tell you, or look at similar cars.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={`/vehicles/${v.slug}#ask-question`}>Tell me if it comes free</ButtonLink>
                <ButtonLink href={`/vehicles/${v.slug}#similar`} variant="secondary">
                  Similar cars
                </ButtonLink>
              </div>
            </div>
          ) : quote.blocked === "sold" ? (
            <div className="surface-card p-7 md:p-9">
              <p className="kicker">Sold</p>
              <h2 className="mt-3 text-display-3">This car has been sold.</h2>
              <ButtonLink href={`/vehicles/${v.slug}#similar`} className="mt-8">
                See similar cars
              </ButtonLink>
            </div>
          ) : quote.blocked === "unlisted" ? (
            <div className="surface-card p-7 md:p-9">
              <p className="kicker">Not on sale</p>
              <h2 className="mt-3 text-display-3">This car is not on sale right now.</h2>
              <ButtonLink href="/vehicles" className="mt-8">
                See the cars for sale
              </ButtonLink>
            </div>
          ) : quote.blocked ? (
            <div className="surface-card p-7 md:p-9">
              <p className="kicker">Reserve with the team</p>
              <h2 className="mt-3 text-display-3">This one is reserved by phone.</h2>
              <p className="mt-4 text-text-secondary">
                {quote.blocked === "offsite" ? "This car is not at our showroom, so the team arranges the viewing and the deposit with you." : "This car has no listed price yet, so the team agrees the deposit with you."}{" "}
                Call{" "}
                <a href={`tel:${site.phones[0].e164}`} className="figures font-semibold text-text-primary">
                  {site.phones[0].display}
                </a>
                .
              </p>
              <ButtonLink href={`/vehicles/${v.slug}#call-me-back`} className="mt-8">
                Or leave your number
              </ButtonLink>
            </div>
          ) : (
            <ReserveForm slug={v.slug} title={title} choices={quote.choices} />
          )}
        </div>
      </div>
    </article>
  );
}
