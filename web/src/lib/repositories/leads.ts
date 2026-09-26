import "server-only";
import { aliasedTable, and, asc, count, desc, eq, gte, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  leadActivity,
  leads,
  partners,
  pushSubscriptions,
  reviews,
  staff,
  vehicleRequests,
  vehicles,
  vehicleWatches,
  type Lead,
} from "@/db/schema";
import { RESPONSE_TARGET_MINUTES } from "@/lib/lead-labels";
import { normalisePhone } from "@/lib/phone";
import { referenceFor } from "@/lib/reference";
import { clockStartsAt, responseMinutes } from "@/lib/showroom-hours";

/**
 * The staff inbox: every enquiry from every form, in one place.
 *
 * "Waiting" is the view that matters — someone asked and nobody has answered.
 * It is sorted longest-wait first, because the buyer who has waited longest
 * is the one most likely to be calling another dealer.
 */

const OPEN: Lead["status"][] = ["new", "contacted", "qualified"];
const CLOSED: Lead["status"][] = ["won", "lost"];

export const LEAD_VIEWS = {
  waiting: "Waiting for a reply",
  mine: "Mine",
  progress: "In progress",
  closed: "Closed",
  all: "All",
} as const;

export type LeadView = keyof typeof LEAD_VIEWS;

/** Real work: not a price watch (it waits for a price cut), not an enquiry answered on the old site. */
const isWork = and(ne(leads.type, "watch"), ne(leads.channel, "legacy_import"));
const isWaiting = and(eq(leads.status, "new"), isWork);

function viewWhere(view: LeadView, me: string): SQL | undefined {
  switch (view) {
    case "waiting":
      return isWaiting;
    case "mine":
      return and(eq(leads.assignedTo, me), inArray(leads.status, OPEN));
    case "progress":
      return inArray(leads.status, ["contacted", "qualified"]);
    case "closed":
      return inArray(leads.status, CLOSED);
    case "all":
      return undefined;
  }
}

/** A reference (SC-4F2A91), a phone number, or part of a name. */
function searchWhere(q: string): SQL | undefined {
  const text = q.trim();
  if (!text) return undefined;
  const ref = text.match(/^(?:SC-?)?([0-9a-f]{6})$/i);
  if (ref) return sql`replace(${leads.id}::text, '-', '') like ${ref[1].toLowerCase() + "%"}`;
  const phone = normalisePhone(text);
  return or(
    ilike(leads.name, `%${text.replace(/[%_]/g, "")}%`),
    ilike(leads.email, `%${text.replace(/[%_]/g, "")}%`),
    phone ? eq(leads.phone, phone) : undefined,
  );
}

export interface InboxLead extends Pick<
  Lead,
  "id" | "type" | "status" | "channel" | "name" | "phone" | "email" | "createdAt" | "firstResponseAt" | "escalatedAt"
> {
  reference: string;
  /** The car they asked about, or the first line of what they wrote. */
  about: string;
  vehicleSlug: string | null;
  assignee: string | null;
  /** Showroom minutes since it arrived — only for leads still waiting. */
  waitingMinutes: number | null;
}

const assignee = aliasedTable(staff, "assignee");

export async function inbox(dealerId: string, me: string, view: LeadView, q = ""): Promise<InboxLead[]> {
  const waitingFirst = view === "waiting";
  const rows = await db
    .select({
      lead: leads,
      vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug },
      assignee: { fullName: assignee.fullName, email: assignee.email },
    })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(and(eq(leads.dealerId, dealerId), q ? searchWhere(q) : viewWhere(view, me)))
    .orderBy(waitingFirst && !q ? asc(leads.createdAt) : desc(leads.createdAt))
    .limit(200);

  const now = new Date();
  return rows.map(({ lead, vehicle, assignee }) => ({
    id: lead.id,
    type: lead.type,
    status: lead.status,
    channel: lead.channel,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    createdAt: lead.createdAt,
    firstResponseAt: lead.firstResponseAt,
    escalatedAt: lead.escalatedAt,
    reference: referenceFor(lead.id),
    about: vehicle?.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : (lead.message ?? "").split("\n")[0].slice(0, 120),
    vehicleSlug: vehicle?.slug ?? null,
    assignee: assignee?.fullName ?? assignee?.email ?? null,
    waitingMinutes:
      lead.status === "new" && lead.type !== "watch" && lead.channel !== "legacy_import" ? responseMinutes(lead.createdAt, now) : null,
  }));
}

export async function inboxCounts(dealerId: string, me: string): Promise<Record<LeadView, number>> {
  const n = async (where: SQL | undefined) =>
    (
      await db
        .select({ n: count() })
        .from(leads)
        .where(and(eq(leads.dealerId, dealerId), where))
    )[0].n;
  const [waiting, mine, progress, closed, all] = await Promise.all((Object.keys(LEAD_VIEWS) as LeadView[]).map((v) => n(viewWhere(v, me))));
  return { waiting, mine, progress, closed, all };
}

/** For the nav badge: enquiries nobody has answered. */
export async function waitingCount(dealerId: string): Promise<number> {
  return (
    await db
      .select({ n: count() })
      .from(leads)
      .where(and(eq(leads.dealerId, dealerId), isWaiting))
  )[0].n;
}

export interface ResponseStats {
  days: number;
  received: number;
  answered: number;
  /** Showroom minutes to first contact, middle value. */
  medianMinutes: number | null;
  /** Share of answered leads reached within the target. */
  withinTarget: number | null;
  escalated: number;
  people: { name: string; answered: number; medianMinutes: number }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * How fast Sabicars answers, measured on showroom time: the minutes between
 * an enquiry arriving (or the showroom opening, if it came overnight) and the
 * first call, WhatsApp or email to the buyer.
 */
export async function responseStats(dealerId: string, days = 30): Promise<ResponseStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      createdAt: leads.createdAt,
      firstResponseAt: leads.firstResponseAt,
      escalatedAt: leads.escalatedAt,
      person: sql<string | null>`coalesce(${assignee.fullName}, ${assignee.email})`,
    })
    .from(leads)
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(and(eq(leads.dealerId, dealerId), gte(leads.createdAt, since), isWork));

  const answered = rows
    .filter((r) => r.firstResponseAt)
    .map((r) => ({ person: r.person, minutes: responseMinutes(r.createdAt, r.firstResponseAt!) }));
  const byPerson = new Map<string, number[]>();
  for (const a of answered) if (a.person) byPerson.set(a.person, [...(byPerson.get(a.person) ?? []), a.minutes]);

  return {
    days,
    received: rows.length,
    answered: answered.length,
    medianMinutes: median(answered.map((a) => a.minutes)),
    withinTarget: answered.length ? answered.filter((a) => a.minutes <= RESPONSE_TARGET_MINUTES).length / answered.length : null,
    escalated: rows.filter((r) => r.escalatedAt).length,
    people: [...byPerson]
      .map(([name, ms]) => ({ name, answered: ms.length, medianMinutes: median(ms)! }))
      .sort((a, b) => b.answered - a.answered),
  };
}

export interface LeadDetail {
  lead: Lead;
  reference: string;
  vehicle: { id: string; title: string; slug: string; priceMinor: number | null; status: string } | null;
  assignee: { id: string; name: string } | null;
  /** Showroom minutes it waited (or has been waiting) for its first reply. */
  responseMinutes: number | null;
  clockStartedAt: Date;
  activity: { id: string; kind: string; detail: string | null; createdAt: Date; by: string | null }[];
  /** Earlier and later enquiries from the same phone or email. */
  history: { id: string; reference: string; type: Lead["type"]; status: Lead["status"]; createdAt: Date }[];
  request: { id: string; want: string; status: string } | null;
  watching: { title: string; slug: string }[];
  /** The partner whose link brought this buyer — owed 1.5% if it sells. */
  referredBy: { code: string; name: string } | null;
  /** The buyer is a registered partner: partner price, no commission. */
  buyerIsPartner: { code: string } | null;
  /** The review they left through their private link, once they have. */
  review: { rating: number; isApproved: boolean; reviewedAt: Date | null } | null;
}

export async function leadDetail(dealerId: string, id: string): Promise<LeadDetail | null> {
  const [row] = await db
    .select({
      lead: leads,
      vehicle: {
        id: vehicles.id,
        year: vehicles.year,
        make: vehicles.make,
        model: vehicles.model,
        slug: vehicles.slug,
        priceMinor: vehicles.priceMinor,
        status: vehicles.status,
      },
      assignee: { id: assignee.id, fullName: assignee.fullName, email: assignee.email },
    })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(and(eq(leads.id, id), eq(leads.dealerId, dealerId)))
    .limit(1);
  if (!row) return null;
  const { lead } = row;

  const sameBuyer = or(lead.phone ? eq(leads.phone, lead.phone) : undefined, lead.email ? eq(leads.email, lead.email) : undefined);
  const [activity, history, [request], watching, [referrer], [asPartner], [review]] = await Promise.all([
    db
      .select({
        id: leadActivity.id,
        kind: leadActivity.kind,
        detail: leadActivity.detail,
        createdAt: leadActivity.createdAt,
        by: sql<string | null>`coalesce(${staff.fullName}, ${staff.email})`,
      })
      .from(leadActivity)
      .leftJoin(staff, eq(staff.id, leadActivity.staffId))
      .where(eq(leadActivity.leadId, id))
      .orderBy(desc(leadActivity.createdAt)),
    sameBuyer
      ? db
          .select({ id: leads.id, type: leads.type, status: leads.status, createdAt: leads.createdAt })
          .from(leads)
          .where(and(eq(leads.dealerId, dealerId), ne(leads.id, id), sameBuyer))
          .orderBy(desc(leads.createdAt))
          .limit(20)
      : Promise.resolve([]),
    db
      .select({ id: vehicleRequests.id, want: vehicleRequests.want, status: vehicleRequests.status })
      .from(vehicleRequests)
      .where(eq(vehicleRequests.leadId, id))
      .limit(1),
    db
      .select({ year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug })
      .from(vehicleWatches)
      .innerJoin(vehicles, eq(vehicles.id, vehicleWatches.vehicleId))
      .where(eq(vehicleWatches.leadId, id)),
    lead.partnerId
      ? db.select({ code: partners.code, name: partners.name }).from(partners).where(eq(partners.id, lead.partnerId)).limit(1)
      : Promise.resolve([]),
    lead.phone
      ? db
          .select({ code: partners.code })
          .from(partners)
          .where(and(eq(partners.dealerId, dealerId), eq(partners.phone, lead.phone)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ rating: reviews.rating, isApproved: reviews.isApproved, reviewedAt: reviews.reviewedAt })
      .from(reviews)
      .where(eq(reviews.leadId, id))
      .limit(1),
  ]);

  const counts = lead.status === "new" || lead.firstResponseAt;
  return {
    lead,
    reference: referenceFor(lead.id),
    vehicle: row.vehicle?.id
      ? {
          id: row.vehicle.id,
          title: `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`,
          slug: row.vehicle.slug,
          priceMinor: row.vehicle.priceMinor,
          status: row.vehicle.status,
        }
      : null,
    assignee: row.assignee?.id ? { id: row.assignee.id, name: row.assignee.fullName ?? row.assignee.email } : null,
    responseMinutes:
      counts && lead.channel !== "legacy_import" ? responseMinutes(lead.createdAt, lead.firstResponseAt ?? new Date()) : null,
    clockStartedAt: clockStartsAt(lead.createdAt),
    activity,
    history: history.map((h) => ({ ...h, reference: referenceFor(h.id) })),
    request: request ?? null,
    watching: watching.map((w) => ({ title: `${w.year} ${w.make} ${w.model}`, slug: w.slug })),
    referredBy: referrer ?? null,
    buyerIsPartner: asPartner ?? null,
    review: review ?? null,
  };
}

/** Everyone a lead can be handed to. */
export async function assignableStaff(dealerId: string): Promise<{ id: string; name: string; role: string }[]> {
  const rows = await db
    .select({ id: staff.id, fullName: staff.fullName, email: staff.email, role: staff.role })
    .from(staff)
    .where(and(eq(staff.dealerId, dealerId), eq(staff.isActive, true)))
    .orderBy(asc(staff.fullName));
  return rows.map((r) => ({ id: r.id, name: r.fullName ?? r.email, role: r.role }));
}

/** This person's alert settings and how many phones they have subscribed. */
export async function myAlertSettings(staffId: string): Promise<{ receivesAlerts: boolean; phones: number }> {
  const [[me], [{ n }]] = await Promise.all([
    db.select({ receivesAlerts: staff.receivesAlerts }).from(staff).where(eq(staff.id, staffId)).limit(1),
    db.select({ n: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.staffId, staffId)),
  ]);
  return { receivesAlerts: me?.receivesAlerts ?? false, phones: n };
}
