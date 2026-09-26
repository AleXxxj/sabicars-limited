import "server-only";
import { and, count, desc, eq, inArray, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, partners, requestMatches, vehicleRequests, vehicles, type RequestMatch, type VehicleRequest } from "@/db/schema";
import { referenceFor } from "@/lib/leads";

/** The board's views, in the order staff work through them. */
export const REQUEST_VIEWS = {
  review: { label: "To review", statuses: ["open"] },
  sourcing: { label: "Sourcing", statuses: ["sourcing"] },
  matched: { label: "Matched", statuses: ["matched"] },
  done: { label: "Done", statuses: ["fulfilled", "closed"] },
} as const satisfies Record<string, { label: string; statuses: VehicleRequest["status"][] }>;

export type RequestView = keyof typeof REQUEST_VIEWS;

export interface BoardMatch extends Pick<RequestMatch, "id" | "status" | "channel" | "sentAt" | "error"> {
  vehicle: { title: string; slug: string; priceMinor: number | null; status: string };
}

export interface BoardRequest extends Pick<VehicleRequest, "id" | "want" | "yearFrom" | "budgetMaxMinor" | "payment" | "status" | "staffNote" | "createdAt"> {
  reference: string;
  buyer: { name: string; phone: string | null; email: string | null; preferredContact: string | null };
  /** The partner whose link brought this buyer — owed 1.5% if it sells. */
  referredBy: string | null;
  /** The buyer is a registered partner: no commission, partner price instead. */
  buyerIsPartner: string | null;
  matches: BoardMatch[];
}

export async function requestCounts(dealerId: string): Promise<Record<RequestView, number> & { toNotify: number }> {
  const rows = await db
    .select({ status: vehicleRequests.status, n: count() })
    .from(vehicleRequests)
    .where(eq(vehicleRequests.dealerId, dealerId))
    .groupBy(vehicleRequests.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<VehicleRequest["status"], number>>;
  const [{ toNotify }] = await db
    .select({ toNotify: count() })
    .from(requestMatches)
    .innerJoin(vehicleRequests, eq(vehicleRequests.id, requestMatches.requestId))
    .where(and(eq(vehicleRequests.dealerId, dealerId), inArray(requestMatches.status, ["pending", "failed"])));
  const sum = (v: RequestView) => REQUEST_VIEWS[v].statuses.reduce((n, s) => n + (by[s] ?? 0), 0);
  return { review: sum("review"), sourcing: sum("sourcing"), matched: sum("matched"), done: sum("done"), toNotify };
}

export async function requestBoard(dealerId: string, view: RequestView): Promise<BoardRequest[]> {
  const rows = await db
    .select({
      request: vehicleRequests,
      lead: { id: leads.id, name: leads.name, phone: leads.phone, email: leads.email, preferredContact: leads.preferredContact, partnerId: leads.partnerId },
    })
    .from(vehicleRequests)
    .innerJoin(leads, eq(leads.id, vehicleRequests.leadId))
    .where(and(eq(vehicleRequests.dealerId, dealerId), inArray(vehicleRequests.status, [...REQUEST_VIEWS[view].statuses])))
    .orderBy(desc(vehicleRequests.createdAt))
    .limit(200);
  if (!rows.length) return [];

  const requestIds = rows.map((r) => r.request.id);
  const phones = rows.map((r) => r.lead.phone).filter((p): p is string => Boolean(p));
  const partnerIds = rows.map((r) => r.lead.partnerId).filter((p): p is string => Boolean(p));

  const [matchRows, partnerRows] = await Promise.all([
    db
      .select({
        requestId: requestMatches.requestId,
        id: requestMatches.id,
        status: requestMatches.status,
        channel: requestMatches.channel,
        sentAt: requestMatches.sentAt,
        error: requestMatches.error,
        vehicle: { make: vehicles.make, model: vehicles.model, year: vehicles.year, slug: vehicles.slug, priceMinor: vehicles.priceMinor, status: vehicles.status },
      })
      .from(requestMatches)
      .innerJoin(vehicles, eq(vehicles.id, requestMatches.vehicleId))
      .where(inArray(requestMatches.requestId, requestIds))
      .orderBy(desc(requestMatches.createdAt)),
    db
      .select({ id: partners.id, code: partners.code, phone: partners.phone })
      .from(partners)
      // The partners who referred these buyers, and any buyers who are partners themselves.
      .where(and(eq(partners.dealerId, dealerId), or(phones.length ? inArray(partners.phone, phones) : undefined, partnerIds.length ? inArray(partners.id, partnerIds) : undefined) ?? sql`false`)),
  ]);

  const codeById = new Map(partnerRows.map((p) => [p.id, p.code]));
  const codeByPhone = new Map(partnerRows.map((p) => [p.phone, p.code]));

  return rows.map(({ request: r, lead }) => ({
    id: r.id,
    want: r.want,
    yearFrom: r.yearFrom,
    budgetMaxMinor: r.budgetMaxMinor,
    payment: r.payment,
    status: r.status,
    staffNote: r.staffNote,
    createdAt: r.createdAt,
    reference: referenceFor(lead.id),
    buyer: { name: lead.name, phone: lead.phone, email: lead.email, preferredContact: lead.preferredContact },
    referredBy: lead.partnerId ? (codeById.get(lead.partnerId) ?? null) : null,
    buyerIsPartner: lead.phone ? (codeByPhone.get(lead.phone) ?? null) : null,
    matches: matchRows
      .filter((m) => m.requestId === r.id)
      .map((m) => ({
        id: m.id,
        status: m.status,
        channel: m.channel,
        sentAt: m.sentAt,
        error: m.error,
        vehicle: { title: `${m.vehicle.year} ${m.vehicle.make} ${m.vehicle.model}`, slug: m.vehicle.slug, priceMinor: m.vehicle.priceMinor, status: m.vehicle.status },
      })),
  }));
}

/**
 * What buyers are waiting for, grouped — the sourcing list. Every active
 * request counts, whether or not staff have reviewed it yet.
 */
export async function demandSummary(dealerId: string, limit = 8): Promise<{ want: string; requests: number; topBudgetMinor: number | null }[]> {
  const key = sql<string>`lower(btrim(${vehicleRequests.want}))`;
  const rows = await db
    .select({ want: sql<string>`min(btrim(${vehicleRequests.want}))`, requests: count(), topBudgetMinor: max(vehicleRequests.budgetMaxMinor) })
    .from(vehicleRequests)
    .where(and(eq(vehicleRequests.dealerId, dealerId), inArray(vehicleRequests.status, ["open", "sourcing", "matched"])))
    .groupBy(key)
    .orderBy(desc(count()), key)
    .limit(limit);
  return rows.map((r) => ({ want: r.want, requests: r.requests, topBudgetMinor: r.topBudgetMinor === null ? null : Number(r.topBudgetMinor) }));
}
