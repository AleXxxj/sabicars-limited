import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { site } from "@/lib/site";

/**
 * A ceiling on how often one connection can use a public form.
 *
 * It exists to stop a script, not a crowd. Nigerian mobile networks put
 * thousands of phones behind one public address (carrier-grade NAT), so a
 * real viral moment can bring many genuine people through the same address.
 * The limits below are therefore generous: a person filling in a form a few
 * times is nowhere near them, a whole carrier's worth of real buyers in ten
 * minutes rarely is, and a script sending hundreds a minute is stopped after
 * the first few dozen.
 *
 * The count is shared by every server instance (one upsert on rate_limits).
 * The address is kept only as a keyed hash (HMAC with a server secret), so
 * the table cannot be turned back into addresses. Once a connection is over
 * its limit, this server instance refuses it from memory for the rest of the
 * window without asking the database again, so a flood costs the database
 * almost nothing. The first refusal in each bucket is put on the status page
 * (lib/incidents.ts), so the owner can see if real people are being turned
 * away. If the counter itself cannot be reached, the form is allowed: a
 * broken limiter must never turn real customers away.
 *
 * Which address: on Vercel, x-real-ip and x-forwarded-for are set by Vercel
 * itself to the real client address, whatever the visitor sends, so they
 * cannot be forged. That holds only while visitors reach Vercel directly:
 * never put another proxy (such as Cloudflare with its orange cloud) in front
 * of the domain, or every visitor would arrive from the proxy's few addresses
 * and share one count. Running locally, `next start` fills the header from
 * the connection, so each local client is its own key.
 */

export type Bucket = "enquiry" | "partner" | "subscribe" | "review" | "comment" | "account" | "signin" | "engage";

const LIMITS: Record<Bucket, { max: number; windowSeconds: number }> = {
  /** Contact, car enquiries, viewings, fleet, sourcing, sell, Drive Plan, call-backs, alerts. */
  enquiry: { max: 30, windowSeconds: 600 },
  /** Refer & Earn registrations. */
  partner: { max: 30, windowSeconds: 600 },
  /** Newsletter sign-ups. */
  subscribe: { max: 30, windowSeconds: 600 },
  /** Reviews left through a buyer's private link. */
  review: { max: 10, windowSeconds: 600 },
  /** Comments on articles. */
  comment: { max: 10, windowSeconds: 600 },
  /** A partner changing their bank account from their private page. */
  account: { max: 10, windowSeconds: 3600 },
  /** Staff sign-in attempts: enough for a mistyped password, not for guessing one. */
  signin: { max: 10, windowSeconds: 900 },
  /** Reactions and shares on articles, and fetches of a viewing's calendar file: silent when over, so nobody notices, nobody can inflate them, and nobody can walk through references. */
  engage: { max: 60, windowSeconds: 600 },
};

/** What a visitor sees when the ceiling is reached: plain, with a human to call. */
export const RATE_LIMITED_MESSAGE = `Too many requests from your connection just now. Please try again in a few minutes, or call ${site.phones[0].display}.`;

/** The secret the address hash is keyed with. CRON_SECRET is already a long random server secret. */
function hashSecret(): string {
  return process.env.RATE_LIMIT_SECRET ?? process.env.CRON_SECRET ?? "sabicars-local-development";
}

/** The client's address as Vercel reports it, as a keyed hash. */
async function clientKey(): Promise<string> {
  const h = await headers();
  const address = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", hashSecret()).update(address).digest("hex").slice(0, 32);
}

/** Connections this instance already knows are over a limit, until their window ends: bucket:key → window end. */
const overLimit = new Map<string, number>();
/** Buckets whose first refusal of the current window has already been put on record. */
const reported = new Map<Bucket, number>();

function windowOf(bucket: Bucket, now: number): { start: Date; end: number } {
  const ms = LIMITS[bucket].windowSeconds * 1000;
  const start = Math.floor(now / ms) * ms;
  return { start: new Date(start), end: start + ms };
}

async function reportRefusal(bucket: Bucket, windowEnd: number): Promise<void> {
  if ((reported.get(bucket) ?? 0) >= windowEnd) return;
  reported.set(bucket, windowEnd);
  try {
    const { recordIncident } = await import("@/lib/incidents");
    const { max, windowSeconds } = LIMITS[bucket];
    await recordIncident({
      kind: "check",
      message: `The ${bucket} form turned away a connection that went over ${max} in ${windowSeconds / 60} minutes. A script, or a crowd behind one mobile network address; if real buyers are being refused, raise the limit in lib/rate-limit.ts.`,
      path: `rate-limit:${bucket}`,
    });
  } catch {
    /* On record or not, the refusal stands. */
  }
}

/**
 * Counts this use and says whether it is within the ceiling. Call it after a
 * form has passed validation and the bot check, just before the write.
 */
export async function withinLimit(bucket: Bucket): Promise<boolean> {
  const { max } = LIMITS[bucket];
  const now = Date.now();
  const { start, end } = windowOf(bucket, now);
  try {
    const keyHash = await clientKey();
    const memo = `${bucket}:${keyHash}`;
    if ((overLimit.get(memo) ?? 0) > now) return false;

    const [row] = await db
      .insert(rateLimits)
      .values({ bucket, keyHash, windowStart: start, count: 1 })
      .onConflictDoUpdate({ target: [rateLimits.bucket, rateLimits.keyHash, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count });
    // Now and then, clear windows that ended long ago, so the table stays small without a job of its own.
    if (Math.random() < 0.01) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now - 2 * 86_400_000)));
      for (const [k, until] of overLimit) if (until <= now) overLimit.delete(k);
    }
    if ((row?.count ?? 1) <= max) return true;
    overLimit.set(memo, end);
    await reportRefusal(bucket, end);
    return false;
  } catch (e) {
    console.error("[rate-limit] counter unavailable, allowing", e instanceof Error ? e.message : e);
    return true;
  }
}

/** For tests and the status page: the ceilings in force. */
export function limitFor(bucket: Bucket): { max: number; windowSeconds: number } {
  return LIMITS[bucket];
}
