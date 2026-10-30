import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { dealers, leads, requestMatches, vehicleRequests, vehicleWatches, type NewLead } from "@/db/schema";
import { escalateStaleLeads, notifyNewLead } from "@/lib/alerts";
import { activePartnerByCode, PARTNER_COOKIE } from "@/lib/partners";
import { referenceFor } from "@/lib/reference";
import { SLOT_CAPACITY } from "@/lib/viewings";

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

/** Re-exported: forms and the admin read references from here. */
export { referenceFor };

/**
 * The dealer row's id never changes, so each server instance looks it up
 * once instead of on every form, read and reaction. A failed lookup is not
 * remembered: the next call tries again.
 */
let dealerIdOnce: Promise<string> | null = null;

export async function sabicarsDealerId(): Promise<string> {
  dealerIdOnce ??= (async () => {
    const [row] = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.slug, "sabicars")).limit(1);
    if (!row) throw new Error("The Sabicars dealer row is missing.");
    return row.id;
  })().catch((e) => {
    dealerIdOnce = null;
    throw e;
  });
  return dealerIdOnce;
}

/**
 * The Refer & Earn partner whose link brought this visitor, if any. A partner
 * enquiring through their own link is not their own referral. Attribution is
 * a bonus on top of the lead: any failure here returns null rather than
 * costing the customer's enquiry.
 */
async function referringPartnerId(dealerId: string, buyerPhone: string | null | undefined): Promise<string | null> {
  try {
    const partner = await activePartnerByCode(dealerId, (await cookies()).get(PARTNER_COOKIE)?.value ?? "");
    return partner && partner.phone !== buyerPhone ? partner.id : null;
  } catch (e) {
    console.error("[leads] partner attribution failed", e);
    return null;
  }
}

/**
 * Staff are alerted after the buyer has their reference — the alert never
 * delays the response, and a failed alert never costs the lead. Every alert
 * run also sweeps for leads left waiting too long.
 */
function alertStaff(leadId: string) {
  after(async () => {
    try {
      await notifyNewLead(leadId);
      await escalateStaleLeads();
    } catch (e) {
      console.error("[leads] alerting staff failed", e);
    }
  });
}

/**
 * Saves the lead and returns its reference. The database write is the
 * commitment to the customer; alerting staff is layered on top and can
 * never cost the lead.
 */
export async function saveLead(values: NewLead): Promise<string> {
  const partnerId = values.partnerId ?? (await referringPartnerId(values.dealerId, values.phone));
  const [row] = await db
    .insert(leads)
    .values({ ...values, partnerId })
    .returning({ id: leads.id });
  alertStaff(row.id);
  return referenceFor(row.id);
}

/** The chosen viewing slot filled up between the buyer opening the page and sending the form. */
export class SlotTaken extends Error {}
/**
 * Saves a viewing booking for its slot, refusing one already at capacity.
 * The slot is locked for the length of the transaction, so two buyers taking
 * its last place at the same moment cannot both succeed.
 */
export async function saveViewing(values: NewLead & { viewingAt: Date }): Promise<{ id: string; reference: string }> {
  const partnerId = values.partnerId ?? (await referringPartnerId(values.dealerId, values.phone));
  const id = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`viewing:${values.dealerId}:${values.viewingAt.toISOString()}`}))`);
    const [{ booked }] = await tx
      .select({ booked: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.dealerId, values.dealerId), eq(leads.type, "viewing"), eq(leads.viewingAt, values.viewingAt), ne(leads.status, "lost")));
    if (booked >= SLOT_CAPACITY) throw new SlotTaken();
    const [row] = await tx
      .insert(leads)
      .values({ ...values, partnerId })
      .returning({ id: leads.id });
    return row.id;
  });
  alertStaff(id);
  return { id, reference: referenceFor(id) };
}

/** How many viewings each upcoming slot already holds, by slot start (ISO). A lost lead frees its place. */
export async function bookedSlots(dealerId: string, now = new Date()): Promise<Record<string, number>> {
  const rows = await db
    .select({ at: leads.viewingAt, booked: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.dealerId, dealerId), eq(leads.type, "viewing"), gte(leads.viewingAt, now), ne(leads.status, "lost")))
    .groupBy(leads.viewingAt);
  return Object.fromEntries(rows.filter((r) => r.at).map((r) => [r.at!.toISOString(), r.booked]));
}

/** A Sourcing Desk request: the lead and the criteria it will be matched on, saved together or not at all. */
export async function saveVehicleRequest(
  lead: NewLead,
  request: { want: string; yearFrom: number | null; budgetMaxMinor: number | null; payment: "cash" | "drive_plan" | "undecided" },
): Promise<{ reference: string; requestId: string }> {
  const partnerId = lead.partnerId ?? (await referringPartnerId(lead.dealerId, lead.phone));
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(leads)
      .values({ ...lead, partnerId })
      .returning({ id: leads.id });
    const [req] = await tx
      .insert(vehicleRequests)
      .values({ dealerId: lead.dealerId, leadId: row.id, ...request })
      .returning({ id: vehicleRequests.id });
    return { leadId: row.id, requestId: req.id };
  });
  alertStaff(saved.leadId);
  return { reference: referenceFor(saved.leadId), requestId: saved.requestId };
}

/**
 * Vehicles the buyer was shown the moment they asked. Recorded as already
 * offered, so the engine never "announces" a car they have seen.
 */
export async function recordShownMatches(requestId: string, vehicleIds: string[]): Promise<void> {
  if (!vehicleIds.length) return;
  const now = new Date();
  await db
    .insert(requestMatches)
    .values(vehicleIds.map((vehicleId) => ({ requestId, vehicleId, status: "sent" as const, channel: "on_screen", sentAt: now })))
    .onConflictDoNothing();
}

/** A price-drop watch: the lead and the vehicles it watches, at the prices the buyer saw. */
export async function saveWatch(lead: NewLead, watched: { vehicleId: string; priceMinor: number | null }[]): Promise<string> {
  const partnerId = lead.partnerId ?? (await referringPartnerId(lead.dealerId, lead.phone));
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(leads)
      .values({ ...lead, partnerId })
      .returning({ id: leads.id });
    await tx
      .insert(vehicleWatches)
      .values(watched.map((w) => ({ dealerId: lead.dealerId, leadId: row.id, vehicleId: w.vehicleId, knownPriceMinor: w.priceMinor })));
    return referenceFor(row.id);
  });
}

/** The reply to a bot: indistinguishable from success, so it learns nothing. */
export const DECOY_REFERENCE = "SC-RECEIVED";
