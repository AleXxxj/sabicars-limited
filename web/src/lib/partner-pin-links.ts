import "server-only";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { partners, type Partner } from "@/db/schema";
import { looksLikeSecret, newSecret, secretHash } from "@/lib/partner-pin";
import { siteUrl } from "@/lib/site";

/**
 * The two ways a partner reaches the "choose your PIN" form without one:
 *
 * - the set-up link (/partner/<access token>), for a partner who has no PIN
 *   yet: those who joined before PINs, or after a manager reset theirs. It
 *   stops working the moment a PIN is set.
 * - a one-time link by email (/partner/pin/<secret>), from "Forgot your PIN?"
 *   or a log-in by a partner with no PIN. It works once, for an hour, and the
 *   database keeps only its sha256.
 */

export const PIN_LINK_MINUTES = 60;
/** At most one new emailed link in this many minutes, so a stranger typing someone's number cannot flood their inbox. */
const PIN_LINK_GAP_MINUTES = 10;

const ACCESS_TOKEN = /^[0-9a-f-]{36}$/i;

/** A fresh one-time PIN link for the partner, or null when one was sent in the last ten minutes. */
export async function issuePinLink(partnerId: string): Promise<string | null> {
  const now = Date.now();
  const secret = newSecret();
  const [row] = await db
    .update(partners)
    .set({ pinResetHash: secretHash(secret), pinResetExpiresAt: new Date(now + PIN_LINK_MINUTES * 60_000) })
    .where(
      and(
        eq(partners.id, partnerId),
        // No link out, or the one out was made more than ten minutes ago.
        or(isNull(partners.pinResetExpiresAt), lt(partners.pinResetExpiresAt, new Date(now + (PIN_LINK_MINUTES - PIN_LINK_GAP_MINUTES) * 60_000))),
      ),
    )
    .returning({ id: partners.id });
  return row ? `${siteUrl()}/partner/pin/${secret}` : null;
}

/** The partner a one-time PIN link belongs to, while it still works. */
export async function partnerByPinLink(secret: string): Promise<Partner | null> {
  if (!looksLikeSecret(secret)) return null;
  const [p] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.pinResetHash, secretHash(secret)), gt(partners.pinResetExpiresAt, new Date())))
    .limit(1);
  return p ?? null;
}

/** The partner a set-up link belongs to, whether or not they have a PIN yet (the page decides what to show). */
export async function partnerBySetupLink(token: string): Promise<Partner | null> {
  if (!ACCESS_TOKEN.test(token)) return null;
  const [p] = await db.select().from(partners).where(eq(partners.accessToken, token)).limit(1);
  return p ?? null;
}
