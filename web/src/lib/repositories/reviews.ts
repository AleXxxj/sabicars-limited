import "server-only";
import { and, avg, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, reviews, staff, vehicles, type Review } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";
import { referenceFor } from "@/lib/reference";

export interface PublicReview {
  id: string;
  name: string;
  location: string | null;
  rating: number;
  message: string;
  createdAt: Date;
  /** Left through the private link issued with a sale on record. */
  verifiedBuyer: boolean;
  vehicle: { title: string; slug: string } | null;
}

/**
 * Published reviews, verified buyers first: a review tied to a sale on record
 * is worth more to the next buyer than any number of kind words.
 */
export async function publishedReviews(limit = 40): Promise<PublicReview[]> {
  const dealerId = await sabicarsDealerId();
  const rows = await db
    .select({ review: reviews, vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug } })
    .from(reviews)
    .leftJoin(vehicles, eq(vehicles.id, reviews.vehicleId))
    .where(and(eq(reviews.dealerId, dealerId), eq(reviews.isApproved, true)))
    .orderBy(sql`${reviews.leadId} IS NULL`, desc(reviews.createdAt))
    .limit(limit);
  return rows.map(({ review: r, vehicle: v }) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    rating: r.rating,
    message: r.message,
    createdAt: r.createdAt,
    verifiedBuyer: Boolean(r.leadId),
    vehicle: v?.slug ? { title: `${v.year} ${v.make} ${v.model}`, slug: v.slug } : null,
  }));
}

export async function reviewSummary(): Promise<{ count: number; average: number | null; verified: number }> {
  const dealerId = await sabicarsDealerId();
  const [row] = await db
    .select({ n: count(), average: avg(reviews.rating), verified: sql<number>`count(${reviews.leadId})::int` })
    .from(reviews)
    .where(and(eq(reviews.dealerId, dealerId), eq(reviews.isApproved, true)));
  return { count: row.n, average: row.average === null ? null : Number(row.average), verified: row.verified };
}

/* ── Staff ─────────────────────────────────────────────────────────────── */

export const REVIEW_VIEWS = { waiting: "Waiting", published: "Published", hidden: "Hidden" } as const;
export type ReviewView = keyof typeof REVIEW_VIEWS;

const viewWhere = (view: ReviewView) =>
  view === "waiting"
    ? isNull(reviews.reviewedAt)
    : view === "published"
      ? eq(reviews.isApproved, true)
      : and(isNotNull(reviews.reviewedAt), eq(reviews.isApproved, false));

export interface QueuedReview extends Pick<
  Review,
  "id" | "name" | "location" | "rating" | "message" | "createdAt" | "reviewedAt" | "isApproved" | "legacyId"
> {
  reviewedBy: string | null;
  buyer: { leadId: string; reference: string } | null;
  vehicle: { title: string; slug: string } | null;
}

export async function reviewQueue(dealerId: string, view: ReviewView): Promise<QueuedReview[]> {
  const rows = await db
    .select({
      review: reviews,
      by: sql<string | null>`coalesce(${staff.fullName}, ${staff.email})`,
      vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug },
    })
    .from(reviews)
    .leftJoin(staff, eq(staff.id, reviews.reviewedBy))
    .leftJoin(vehicles, eq(vehicles.id, reviews.vehicleId))
    .where(and(eq(reviews.dealerId, dealerId), viewWhere(view)))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
  return rows.map(({ review: r, by, vehicle: v }) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    rating: r.rating,
    message: r.message,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    isApproved: r.isApproved,
    legacyId: r.legacyId,
    reviewedBy: by,
    buyer: r.leadId ? { leadId: r.leadId, reference: referenceFor(r.leadId) } : null,
    vehicle: v?.slug ? { title: `${v.year} ${v.make} ${v.model}`, slug: v.slug } : null,
  }));
}

export async function reviewCounts(dealerId: string): Promise<Record<ReviewView, number>> {
  const n = async (v: ReviewView) =>
    (
      await db
        .select({ n: count() })
        .from(reviews)
        .where(and(eq(reviews.dealerId, dealerId), viewWhere(v)))
    )[0].n;
  const [waiting, published, hidden] = await Promise.all([n("waiting"), n("published"), n("hidden")]);
  return { waiting, published, hidden };
}

/* ── A buyer's private review link ─────────────────────────────────────── */

export interface BuyerInvite {
  leadId: string;
  dealerId: string;
  firstName: string;
  vehicle: { id: string; title: string } | null;
  existing: Pick<Review, "rating" | "message" | "isApproved"> | null;
}

/** The sale behind a review link, if the link is genuine and the lead is a sale. */
export async function buyerInvite(token: string): Promise<BuyerInvite | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [row] = await db
    .select({ lead: leads, vehicle: { id: vehicles.id, year: vehicles.year, make: vehicles.make, model: vehicles.model } })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .where(and(eq(leads.reviewToken, token), eq(leads.status, "won")))
    .limit(1);
  if (!row) return null;
  const [existing] = await db
    .select({ rating: reviews.rating, message: reviews.message, isApproved: reviews.isApproved })
    .from(reviews)
    .where(eq(reviews.leadId, row.lead.id))
    .limit(1);
  return {
    leadId: row.lead.id,
    dealerId: row.lead.dealerId,
    firstName: row.lead.name.trim().split(/\s+/)[0],
    vehicle: row.vehicle?.id ? { id: row.vehicle.id, title: `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}` } : null,
    existing: existing ?? null,
  };
}
