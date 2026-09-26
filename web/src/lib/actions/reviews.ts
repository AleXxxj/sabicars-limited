"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leadActivity, reviews } from "@/db/schema";
import { notifyManagers } from "@/lib/alerts";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";
import { buyerInvite } from "@/lib/repositories/reviews";

export interface ReviewFormResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
}

const optional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const reviewSchema = z.object({
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  location: optional(80),
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5),
  message: z.string().trim().min(10, "A sentence or two, please — what was it like?").max(1500, "Keep it under 1,500 characters"),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

function firstErrors(error: z.ZodError): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
}

function values(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k !== "website" && k !== "renderedAt" && k !== "token") out[k] = v;
  return out;
}

async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
}

/** Many real customers share one mobile-network address, so the limit is generous: it stops floods, not people. */
const PER_ADDRESS_PER_HOUR = 5;

function alertManagers(dealerId: string, name: string, rating: number, verified: boolean) {
  after(() =>
    notifyManagers(dealerId, {
      title: `${verified ? "A verified buyer" : name} left a ${rating}-star review`,
      body: "It is waiting for someone to read it before it appears on the site.",
      url: "/admin/reviews",
      tag: "reviews",
    }).catch((e) => console.error("[reviews] alert failed", e)),
  );
}

/** A visitor's review. It appears once a member of staff has read it. */
export async function submitReview(_prev: ReviewFormResult | null, formData: FormData): Promise<ReviewFormResult> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values: values(formData) };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true };

  const dealerId = await sabicarsDealerId();
  const hash = await ipHash();
  if (hash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(reviews)
      .where(and(eq(reviews.ipHash, hash), gte(reviews.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
    if (n >= PER_ADDRESS_PER_HOUR)
      return { ok: false, error: "We have received several reviews from this connection in the last hour. Please try again later." };
  }

  try {
    await db
      .insert(reviews)
      .values({ dealerId, name: v.name, location: v.location ?? null, rating: v.rating, message: v.message, ipHash: hash });
  } catch (e) {
    console.error("[reviews] save failed", e);
    return { ok: false, error: "Your review could not be saved. Please try again.", values: values(formData) };
  }
  alertManagers(dealerId, v.name, v.rating, false);
  revalidatePath("/admin/reviews");
  return { ok: true };
}

/** A buyer's review, through the private link sent after their purchase: marked "Verified buyer". */
export async function submitBuyerReview(_prev: ReviewFormResult | null, formData: FormData): Promise<ReviewFormResult> {
  const invite = await buyerInvite(String(formData.get("token") ?? ""));
  if (!invite) return { ok: false, error: "This review link is not valid. Please ask Sabicars for a new one." };
  if (invite.existing) return { ok: true };

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values: values(formData) };
  const v = parsed.data;

  try {
    await db
      .insert(reviews)
      .values({
        dealerId: invite.dealerId,
        name: v.name,
        location: v.location ?? null,
        rating: v.rating,
        message: v.message,
        leadId: invite.leadId,
        vehicleId: invite.vehicle?.id ?? null,
        ipHash: await ipHash(),
      })
      .onConflictDoNothing({ target: reviews.leadId });
    await db.insert(leadActivity).values({ leadId: invite.leadId, kind: "reviewed", detail: `Left a ${v.rating}-star review` });
  } catch (e) {
    console.error("[reviews] buyer review failed", e);
    return { ok: false, error: "Your review could not be saved. Please try again.", values: values(formData) };
  }
  alertManagers(invite.dealerId, v.name, v.rating, true);
  revalidatePath("/admin/reviews");
  return { ok: true };
}

/** Publish or hide. Reviews are front-page content, so this is for owners and managers. */
export async function moderateReview(reviewId: string, publish: boolean): Promise<{ ok: boolean; error?: string }> {
  const me = await requireStaff();
  if (me.role === "sales") return { ok: false, error: "Only a manager can publish or hide reviews." };
  if (!z.uuid().safeParse(reviewId).success) return { ok: false };
  const [before] = await db
    .select({ isApproved: reviews.isApproved, reviewedAt: reviews.reviewedAt })
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.dealerId, me.dealerId)))
    .limit(1);
  if (!before) return { ok: false, error: "That review no longer exists." };
  if (before.reviewedAt && before.isApproved === publish) return { ok: true };

  await db.update(reviews).set({ isApproved: publish, reviewedAt: new Date(), reviewedBy: me.id }).where(eq(reviews.id, reviewId));
  await audit(me, "review", reviewId, "status_change", { isApproved: [before.isApproved, publish] });
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
