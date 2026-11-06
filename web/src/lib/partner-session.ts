import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { partners, partnerSessions, type Partner } from "@/db/schema";
import { looksLikeSecret, newSecret, secretHash } from "@/lib/partner-pin";

/**
 * A Refer & Earn partner, logged in on a phone. The session cookie carries a
 * random secret (httpOnly, so no script on the page can read it); the
 * database keeps its sha256. A second, readable cookie only says "someone is
 * logged in here", so the header can show Account from the first paint on
 * pages that are the same for everyone (app/layout.tsx).
 */
export const PARTNER_SESSION_COOKIE = "sc_partner_session";
export const SIGNED_IN_COOKIE = "sc_signed_in";

/** Logged in for half a year on the partner's own phone; log out ends it at once. */
const SESSION_DAYS = 180;
const DAY_MS = 86_400_000;

const cookieOptions = (expires: Date) => ({ secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires });

/** Logs this browser in as the partner. Call from a server action, after the PIN has been checked. */
export async function startPartnerSession(partnerId: string): Promise<void> {
  const secret = newSecret();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.insert(partnerSessions).values({ partnerId, tokenHash: secretHash(secret), expiresAt });
  // Now and then, clear sessions that ran out long ago, so the table stays small without a job of its own.
  if (Math.random() < 0.02) await db.delete(partnerSessions).where(lt(partnerSessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(PARTNER_SESSION_COOKIE, secret, { ...cookieOptions(expiresAt), httpOnly: true });
  jar.set(SIGNED_IN_COOKIE, "1", { ...cookieOptions(expiresAt), httpOnly: false });
}

/** The partner logged in on this browser, or null. Only reads: safe on any page. */
export const currentPartner = cache(async (): Promise<Partner | null> => {
  const secret = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value;
  if (!looksLikeSecret(secret)) return null;
  const [row] = await db
    .select({ partner: partners })
    .from(partnerSessions)
    .innerJoin(partners, eq(partners.id, partnerSessions.partnerId))
    .where(and(eq(partnerSessions.tokenHash, secretHash(secret)), gt(partnerSessions.expiresAt, new Date())))
    .limit(1);
  return row?.partner ?? null;
});

/** Logs this browser out: the session ends on the server too, not only in the browser. */
export async function endPartnerSession(): Promise<void> {
  const jar = await cookies();
  const secret = jar.get(PARTNER_SESSION_COOKIE)?.value;
  if (looksLikeSecret(secret)) await db.delete(partnerSessions).where(eq(partnerSessions.tokenHash, secretHash(secret)));
  jar.delete(PARTNER_SESSION_COOKIE);
  jar.delete(SIGNED_IN_COOKIE);
}

/** Logs the partner out everywhere: after a PIN change, or when a manager resets it. */
export async function endAllPartnerSessions(partnerId: string): Promise<void> {
  await db.delete(partnerSessions).where(eq(partnerSessions.partnerId, partnerId));
}
