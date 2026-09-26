import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { ReviewControls } from "@/components/admin/ReviewControls";
import { Stars } from "@/components/reviews/Stars";
import { requireStaff } from "@/lib/auth";
import { REVIEW_VIEWS, reviewCounts, reviewQueue, type ReviewView } from "@/lib/repositories/reviews";

export const metadata: Metadata = { title: "Reviews · Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ view?: string }> };

const when = (d: Date) =>
  new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/**
 * Reviews, before and after they appear on the site.
 *
 * Its one job: keep the reviews page believable. Everything a visitor posts
 * waits here until someone reads it. The test is "is it genuine?", not "is it
 * flattering?" — a real three-star review published is worth more to the next
 * buyer than ten five-stars they suspect.
 */
export default async function ReviewsAdmin({ searchParams }: Props) {
  const me = await requireStaff();
  const sp = await searchParams;
  const view: ReviewView = sp.view && sp.view in REVIEW_VIEWS ? (sp.view as ReviewView) : "waiting";
  const [rows, counts] = await Promise.all([reviewQueue(me.dealerId, view), reviewCounts(me.dealerId)]);
  const canModerate = me.role !== "sales";

  return (
    <>
      <p className="eyebrow">Reviews</p>
      <h1 className="mt-2 text-display-3">What customers say</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        Publish anything genuine, including critical reviews. Hide spam, abuse, or reviews that are not about Sabicars. To get a
        <span className="text-text-primary"> Verified buyer</span> review, open a sale in Enquiries and send the buyer their review link.
      </p>

      <nav aria-label="Review views" className="mt-8 flex gap-6 overflow-x-auto border-b border-border-subtle [scrollbar-width:none]">
        {(Object.keys(REVIEW_VIEWS) as ReviewView[]).map((v) => (
          <Link
            key={v}
            href={v === "waiting" ? "/admin/reviews" : `/admin/reviews?view=${v}`}
            aria-current={view === v ? "true" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors ${
              view === v ? "border-gold-500 text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {REVIEW_VIEWS[v]}{" "}
            <span className={`figures text-xs ${v === "waiting" && counts.waiting ? "text-accent-text" : "text-text-muted"}`}>
              {counts[v]}
            </span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-text-muted">
          {view === "waiting" ? "Nothing waiting. New reviews from the site appear here first." : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className="grid gap-5 border border-border-subtle bg-surface-1 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:p-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} />
                  <span className="text-sm text-text-primary">{r.name}</span>
                  {r.location && <span className="text-sm text-text-muted">{r.location}</span>}
                  <span className="text-xs text-text-muted">{when(r.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-text-primary">{r.message}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  {r.buyer ? (
                    <span className="inline-flex items-center gap-1.5 text-gold-300">
                      <BadgeCheck aria-hidden size={14} /> Verified buyer
                      {r.vehicle && ` · ${r.vehicle.title}`} ·{" "}
                      <Link href={`/admin/leads/${r.buyer.leadId}`} className="underline-offset-4 hover:underline">
                        {r.buyer.reference}
                      </Link>
                    </span>
                  ) : (
                    <span>{r.legacyId ? "From the old site" : "Posted on the site — not linked to a sale"}</span>
                  )}
                  {r.reviewedAt && r.reviewedBy && (
                    <span>
                      {r.isApproved ? "Published" : "Hidden"} by {r.reviewedBy} on {when(r.reviewedAt)}
                    </span>
                  )}
                </p>
              </div>
              {canModerate ? (
                <ReviewControls
                  key={`${r.id}-${r.isApproved}-${Boolean(r.reviewedAt)}`}
                  reviewId={r.id}
                  isApproved={r.isApproved}
                  reviewed={Boolean(r.reviewedAt)}
                />
              ) : (
                <p className="text-xs text-text-muted">A manager publishes reviews.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
