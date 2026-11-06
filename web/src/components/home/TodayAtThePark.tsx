import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { VehicleImage } from "@/components/VehicleImage";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import type { ArrivalCard, CardVehicle, PriceDropCard } from "@/lib/repositories/vehicles";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

const lagos = { timeZone: "Africa/Lagos" } as const;
const sameDay = (a: Date, b: Date) => a.toLocaleDateString("en-NG", { ...lagos }) === b.toLocaleDateString("en-NG", { ...lagos });
/** "today", or the weekday, on Lagos days. */
const whichDay = (d: Date, now: Date) => (sameDay(d, now) ? "today" : d.toLocaleDateString("en-NG", { weekday: "long", ...lagos }));
const fullDate = (d: Date) => d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", ...lagos });
/** The old price out of the platform's announcement ("Now ₦9,000,000, down from ₦9,800,000."); the card already shows the new one. */
const wasPrice = (line: string) => line.match(/down from (₦[\d,]+(?:\.\d+)?\s?[MK]?)/i)?.[1] ?? null;

/**
 * The reason to open Sabicars today: what came in this week and whose price
 * dropped. A short strip, so it reads before the buyer moves on to the cars;
 * on a quiet week it stays away. (The day's video lives with the founder,
 * further down, and sold cars are not shown here: the owner found both broke
 * the flow at the top of the page.)
 */
export function TodayAtThePark({ arrivals, drops, now = new Date() }: { arrivals: ArrivalCard[]; drops: PriceDropCard[]; now?: Date }) {
  if (!arrivals.length && !drops.length) return null;

  const bits = [
    arrivals.length ? `${arrivals.length} new ${arrivals.length === 1 ? "car" : "cars"}` : null,
    drops.length ? `${drops.length} ${drops.length === 1 ? "price" : "prices"} reduced` : null,
  ].filter((b): b is string => Boolean(b));

  return (
    <section aria-labelledby="today-title" className="border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-16">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="kicker">Today at the park · {fullDate(now)}</p>
            <h2 id="today-title" className="mt-4 text-display-2">
              What is new this week.
            </h2>
            <p className="mt-4 text-lg text-text-secondary">This week: {bits.join(" · ")}.</p>
          </div>
        </ScrollReveal>

        {/* minmax(0,1fr): a row of six cards must never widen the column to fit them all; it scrolls instead. */}
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 md:mt-10">
          {arrivals.length > 0 && (
            <Row title="New this week" more={{ label: "See all cars", href: "/vehicles" }}>
              {arrivals.map((v) => (
                <Mini key={v.id} car={v} note={`Added ${whichDay(v.listedAt, now)}`} />
              ))}
            </Row>
          )}
          {drops.length > 0 && (
            <Row title="Price reduced">
              {drops.map((v) => (
                <Mini key={v.id} car={v} was={wasPrice(v.line)} note={`Reduced ${whichDay(v.droppedAt, now)}`} />
              ))}
            </Row>
          )}
        </div>
      </div>
    </section>
  );
}

/** A row of small cars: a swipe on a phone, a grid on a desktop. */
function Row({ title, more, children }: { title: string; more?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <ScrollReveal className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {more && (
          <Link href={more.href} className="text-sm font-semibold text-green-300 hover:text-green-200">
            {more.label} →
          </Link>
        )}
      </div>
      {/* scroll-px-5 keeps the first card inside the page's gutter when the row snaps, instead of flush with the screen's edge. */}
      <ul className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        {children}
      </ul>
    </ScrollReveal>
  );
}

/**
 * One small car: photo, name, price, and the one fact that puts it in this row.
 * With `was`, the old price is struck out beside the new one, so a reduced
 * price reads as a reduced price without a word of explanation.
 */
function Mini({ car, note, was = null, noteClass = "text-text-muted" }: { car: CardVehicle; note: string; was?: string | null; noteClass?: string }) {
  return (
    <li className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-auto">
      <Link href={`/vehicles/${car.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
          <VehicleImage
            src={car.cover?.url ?? VEHICLE_PLACEHOLDER}
            alt={car.cover?.alt ?? vehicleTitle(car)}
            fill
            sizes="(min-width: 1024px) 15vw, (min-width: 768px) 22vw, 45vw"
            className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
          />
        </div>
        <p className="mt-2 truncate text-sm text-text-primary group-hover:text-accent-text">{vehicleTitle(car)}</p>
        {was ? (
          <p className="figures flex flex-wrap items-baseline gap-x-2 text-xs">
            <s className="text-text-muted">{was}</s>
            <span className="font-semibold text-green-300">{priceLabel(car)}</span>
          </p>
        ) : (
          <p className="figures truncate text-xs text-text-secondary">{priceLabel(car)}</p>
        )}
        <p className={`line-clamp-2 text-xs ${noteClass}`}>{note}</p>
      </Link>
    </li>
  );
}
