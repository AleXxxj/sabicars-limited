import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { VehicleImage } from "@/components/VehicleImage";
import { VideoPlayer } from "@/components/blog/VideoPlayer";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import type { TodayVideo } from "@/lib/repositories/today";
import type { ArrivalCard, CardVehicle, PriceDropCard, SoldCard } from "@/lib/repositories/vehicles";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

const lagos = { timeZone: "Africa/Lagos" } as const;
const sameDay = (a: Date, b: Date) => a.toLocaleDateString("en-NG", { ...lagos }) === b.toLocaleDateString("en-NG", { ...lagos });
/** "today", or the weekday, on Lagos days. */
const whichDay = (d: Date, now: Date) => (sameDay(d, now) ? "today" : d.toLocaleDateString("en-NG", { weekday: "long", ...lagos }));
const fullDate = (d: Date) => d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", ...lagos });
/** The old price out of the platform's announcement ("Now ₦9,000,000, down from ₦9,800,000."); the card already shows the new one. */
const wasPrice = (line: string) => line.match(/down from (₦[\d,.]+\s?[MK]?)/i)?.[1] ?? null;

/**
 * The reason to open Sabicars today: what came in this week, whose price
 * dropped, what sold, and the day's video from the park with one line from
 * the founder. Each part shows only when there is something to show, and the
 * whole section stays away on a quiet week with no video.
 */
export function TodayAtThePark({
  arrivals,
  drops,
  sold,
  video,
  now = new Date(),
}: {
  arrivals: ArrivalCard[];
  drops: PriceDropCard[];
  sold: SoldCard[];
  video: TodayVideo | null;
  now?: Date;
}) {
  if (!arrivals.length && !drops.length && !sold.length && !video) return null;

  const bits = [
    arrivals.length ? `${arrivals.length} new ${arrivals.length === 1 ? "car" : "cars"}` : null,
    drops.length ? `${drops.length} price ${drops.length === 1 ? "drop" : "drops"}` : null,
    sold.length ? `${sold.length} sold` : null,
  ].filter((b): b is string => Boolean(b));
  const headline = bits.length ? "What is new this week." : video?.label === "Today's video" ? "From the park today." : "From the park this week.";

  return (
    <section aria-labelledby="today-title" className="border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <ScrollReveal className="max-w-2xl">
          <p className="kicker">Today at the park · {fullDate(now)}</p>
          <h2 id="today-title" className="mt-4 text-display-2">
            {headline}
          </h2>
          {bits.length > 0 && <p className="mt-4 text-lg text-text-secondary">This week: {bits.join(" · ")}.</p>}
        </ScrollReveal>

        <div className={`mt-10 grid gap-12 ${video ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16" : ""}`}>
          {video && (
            <ScrollReveal>
              <p className="text-sm font-medium text-text-muted">{video.label}</p>
              <div className="mt-3">
                <VideoPlayer
                  source={video.source}
                  poster={video.source.kind === "youtube" ? video.source.poster : null}
                  title={video.line || "From the park"}
                />
              </div>
              {video.line && (
                <figure className="mt-5">
                  <blockquote className="font-display text-[1.5rem] leading-snug text-text-primary md:text-[1.75rem]">“{video.line}”</blockquote>
                  <figcaption className="mt-2 text-sm text-text-muted">Ccristian Dee</figcaption>
                </figure>
              )}
            </ScrollReveal>
          )}

          {(arrivals.length > 0 || drops.length > 0 || sold.length > 0) && (
            <div className="grid content-start gap-10">
              {arrivals.length > 0 && (
                <Row title="New this week" more={{ label: "See all cars", href: "/vehicles" }}>
                  {arrivals.map((v) => (
                    <Mini key={v.id} car={v} note={`Added ${whichDay(v.listedAt, now)}`} />
                  ))}
                </Row>
              )}
              {drops.length > 0 && (
                <Row title="Price drops">
                  {drops.map((v) => {
                    const was = wasPrice(v.line);
                    return <Mini key={v.id} car={v} note={was ? `Down from ${was}` : v.line} noteClass="text-green-300" />;
                  })}
                </Row>
              )}
              {sold.length > 0 && (
                <Row title="Sold this week">
                  {sold.map((v) => (
                    <Mini key={v.id} car={v} note={`Sold ${whichDay(v.soldAt, now)}`} sold />
                  ))}
                </Row>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A row of small cars: a swipe on a phone, a grid on a desktop. */
function Row({ title, more, children }: { title: string; more?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <ScrollReveal>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {more && (
          <Link href={more.href} className="text-sm font-semibold text-green-300 hover:text-green-200">
            {more.label} →
          </Link>
        )}
      </div>
      <ul className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {children}
      </ul>
    </ScrollReveal>
  );
}

/** One small car: photo, name, price, and the one fact that puts it in this row. */
function Mini({ car, note, noteClass = "text-text-muted", sold = false }: { car: CardVehicle; note: string; noteClass?: string; sold?: boolean }) {
  return (
    <li className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-auto">
      <Link href={`/vehicles/${car.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
          <VehicleImage
            src={car.cover?.url ?? VEHICLE_PLACEHOLDER}
            alt={car.cover?.alt ?? vehicleTitle(car)}
            fill
            sizes="(min-width: 1024px) 18vw, 45vw"
            className={`object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04] ${sold ? "opacity-70 saturate-50" : ""}`}
          />
          {sold && <span className="glass absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold text-white">Sold</span>}
        </div>
        <p className="mt-2 truncate text-sm text-text-primary group-hover:text-accent-text">{vehicleTitle(car)}</p>
        <p className={`figures truncate text-xs ${sold ? "text-text-muted" : "text-text-secondary"}`}>{priceLabel(car)}</p>
        <p className={`line-clamp-2 text-xs ${noteClass}`}>{note}</p>
      </Link>
    </li>
  );
}
