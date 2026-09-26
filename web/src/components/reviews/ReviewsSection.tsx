import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import type { PublicReview } from "@/lib/repositories/reviews";
import { Stars } from "./Stars";
import { WriteReview } from "./WriteReview";

const month = (d: Date) => new Date(d).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });

function ReviewCard({ r }: { r: PublicReview }) {
  return (
    <figure className="surface-card flex w-[19rem] shrink-0 flex-col p-6 md:w-[22rem]">
      <Stars rating={r.rating} />
      <blockquote className="mt-4 flex-1">
        <p className="line-clamp-6 font-display text-[1.3rem] leading-snug text-text-primary">“{r.message}”</p>
      </blockquote>
      <figcaption className="mt-5 border-t border-white/[0.06] pt-4 text-sm">
        <span className="block font-medium text-text-primary">{r.name}</span>
        <span className="block text-text-muted">{[r.location, month(r.createdAt)].filter(Boolean).join(" · ")}</span>
        {r.verifiedBuyer && (
          <span className="mt-2 flex items-center gap-1.5 text-xs text-gold-300">
            <BadgeCheck aria-hidden size={15} />
            Verified buyer
            {r.vehicle && (
              <>
                {" · "}
                <Link href={`/vehicles/${r.vehicle.slug}`} className="underline-offset-4 hover:underline">
                  {r.vehicle.title}
                </Link>
              </>
            )}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * What customers say. Every review shown was read by a person before it
 * appeared; "Verified buyer" marks one left through the private link Sabicars
 * sends with a purchase — the only verification the page claims.
 */
export function ReviewsSection({
  reviews,
  summary,
  className = "",
}: {
  reviews: PublicReview[];
  summary: { count: number; average: number | null; verified: number };
  className?: string;
}) {
  // A short row still glides smoothly: repeat it until one copy is wider than a desktop screen.
  const row = reviews.length ? Array.from({ length: Math.max(1, Math.ceil(8 / reviews.length)) }, () => reviews).flat() : [];
  return (
    <section id="reviews" aria-labelledby="reviews-title" className={`scroll-mt-24 border-t border-border-subtle ${className}`}>
      <div className="mx-auto max-w-7xl px-5 pt-20 md:px-10 md:pt-28">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <p className="kicker">Reviews</p>
            <h2 id="reviews-title" className="mt-4 text-display-2">
              What customers say.
            </h2>
            {summary.count > 0 && summary.average !== null && (
              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
                <span className="figures font-display text-[2.2rem] leading-none text-text-primary">{summary.average.toFixed(1)}</span>
                <Stars rating={summary.average} size={18} />
                <span>
                  from {summary.count} {summary.count === 1 ? "review" : "reviews"}
                  {summary.verified > 0 && ` · ${summary.verified} verified ${summary.verified === 1 ? "buyer" : "buyers"}`}
                </span>
              </p>
            )}
          </div>
          <WriteReview />
        </ScrollReveal>
      </div>

      {row.length > 0 ? (
        <div
          data-ticker-frame
          className="mt-12 overflow-hidden pb-6 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)] md:mt-14"
          style={{ ["--ticker-duration" as string]: `${row.length * 9}s` }}
        >
          <div data-ticker className="flex w-max gap-4 px-2 md:gap-5">
            <ul className="flex gap-4 md:gap-5">
              {row.map((r, i) =>
                // Each review is read once; the repeats that pad a short row are decoration.
                i < reviews.length ? (
                  <li key={r.id} className="flex">
                    <ReviewCard r={r} />
                  </li>
                ) : (
                  <li key={`pad-${r.id}-${i}`} data-ticker-copy aria-hidden inert className="flex">
                    <ReviewCard r={r} />
                  </li>
                ),
              )}
            </ul>
            {/* The second copy exists only to make the loop seamless. */}
            <ul data-ticker-copy aria-hidden inert className="flex gap-4 md:gap-5">
              {row.map((r, i) => (
                <li key={`copy-${r.id}-${i}`} className="flex">
                  <ReviewCard r={r} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mx-auto max-w-7xl px-5 pt-10 text-text-secondary md:px-10">No reviews yet — be the first.</p>
      )}

      <p className="mx-auto max-w-7xl px-5 pt-6 pb-20 text-sm text-text-muted md:px-10 md:pb-28">
        Every review is read by the team before it appears. “Verified buyer” means it was left through the private link Sabicars sends with
        each purchase.
      </p>
    </section>
  );
}
