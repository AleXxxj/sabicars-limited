import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dealers, leads, type NewLead } from "@/db/schema";

/**
 * The rules every enquiry form shares — vehicle enquiries, the contact page,
 * fleet quotations — so they cannot drift apart.
 */

/** Faster than any person fills in a form: a bot. */
const MIN_FILL_MS = 3_000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** A bot filled the hidden field, or submitted inhumanly fast. */
export function looksAutomated(website: unknown, renderedAt: unknown): boolean {
  const shown = Number(renderedAt);
  return Boolean(website) || (Number.isFinite(shown) && shown > 0 && Date.now() - shown < MIN_FILL_MS);
}

/**
 * Keyed on the phone number, not the IP address: Nigerian mobile networks put
 * many real customers behind one address, and limiting by IP would silently
 * turn genuine buyers away.
 */
export async function tooManyFrom(phone: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.phone, phone), gte(leads.createdAt, since)));
  return recent >= RATE_LIMIT;
}

/** SC- plus the first six characters of the lead id: short enough to read down a phone. */
export function referenceFor(leadId: string): string {
  return `SC-${leadId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export async function sabicarsDealerId(): Promise<string> {
  const [row] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, "sabicars")).limit(1);
  if (!row) throw new Error("The Sabicars dealer row is missing.");
  return row.id;
}

/**
 * Saves the lead and returns its reference. The database write is the
 * commitment to the customer; alerting staff (phase 3) is layered on top and
 * can never cost the lead.
 */
export async function saveLead(values: NewLead): Promise<string> {
  const [row] = await db.insert(leads).values(values).returning({ id: leads.id });
  return referenceFor(row.id);
}

/** The reply to a bot: indistinguishable from success, so it learns nothing. */
export const DECOY_REFERENCE = "SC-RECEIVED";
