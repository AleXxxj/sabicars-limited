"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leadActivity, leads, pushSubscriptions, staff, type Lead } from "@/db/schema";
import { notifyAssigned, pushConfigured, pushToStaff } from "@/lib/alerts";
import { audit } from "@/lib/audit";
import { requireStaff, type StaffMember } from "@/lib/auth";
import { CONTACT_METHODS, LEAD_STATUS_LABEL } from "@/lib/lead-labels";

type Result = { ok: boolean; error?: string };

async function loadLead(me: StaffMember, leadId: string): Promise<Lead | null> {
  if (!z.uuid().safeParse(leadId).success) return null;
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.dealerId, me.dealerId)))
    .limit(1);
  return lead ?? null;
}

async function log(leadId: string, me: StaffMember | null, kind: (typeof leadActivity.$inferInsert)["kind"], detail: string) {
  await db.insert(leadActivity).values({ leadId, staffId: me?.id ?? null, kind, detail });
}

function refresh(leadId: string) {
  revalidatePath(`/admin/leads/${leadId}`);
  // The inbox, and the waiting count in every admin page's navigation.
  revalidatePath("/admin", "layout");
}

const firstName = (me: StaffMember) => (me.fullName ?? me.email).split(/[\s@]/)[0];

/** "I'll take it." Only an unclaimed lead can be claimed — two people never answer the same buyer. */
export async function claimLead(leadId: string): Promise<Result> {
  const me = await requireStaff();
  const lead = await loadLead(me, leadId);
  if (!lead) return { ok: false, error: "That enquiry no longer exists." };
  const [won] = await db
    .update(leads)
    .set({ assignedTo: me.id, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), isNull(leads.assignedTo)))
    .returning({ id: leads.id });
  if (!won) return { ok: false, error: "Someone else has just taken this one." };
  await log(leadId, me, "claimed", "Took this enquiry");
  await audit(me, "lead", leadId, "update", { assignedTo: [null, me.id] });
  refresh(leadId);
  return { ok: true };
}

/** Owners and managers hand a lead to someone — who is told on their phone. */
export async function assignLead(leadId: string, staffId: string): Promise<Result> {
  const me = await requireStaff();
  if (me.role === "sales") return { ok: false, error: "Only a manager can hand enquiries to someone else." };
  const lead = await loadLead(me, leadId);
  if (!lead) return { ok: false, error: "That enquiry no longer exists." };
  const to = staffId || null;
  if (to === lead.assignedTo) return { ok: true };

  let name = "nobody";
  if (to) {
    const [person] = await db
      .select({ fullName: staff.fullName, email: staff.email })
      .from(staff)
      .where(and(eq(staff.id, to), eq(staff.dealerId, me.dealerId), eq(staff.isActive, true)))
      .limit(1);
    if (!person) return { ok: false, error: "That person is not active staff." };
    name = person.fullName ?? person.email;
  }
  await db.update(leads).set({ assignedTo: to, updatedAt: new Date() }).where(eq(leads.id, leadId));
  await log(leadId, me, "assigned", to ? `Gave it to ${name}` : "Released it for anyone to take");
  await audit(me, "lead", leadId, "update", { assignedTo: [lead.assignedTo, to] });
  if (to && to !== me.id)
    after(() => notifyAssigned(leadId, to, firstName(me)).catch((e) => console.error("[leads] assignment alert failed", e)));
  refresh(leadId);
  return { ok: true };
}

/**
 * Staff reached out to the buyer. The first time this happens is the lead's
 * response time — the number the whole engine exists to make small. Reaching
 * out to an unclaimed lead also claims it, so the next person does not call
 * the same buyer again.
 */
export async function recordContact(leadId: string, method: keyof typeof CONTACT_METHODS): Promise<Result> {
  const me = await requireStaff();
  if (!(method in CONTACT_METHODS)) return { ok: false };
  const lead = await loadLead(me, leadId);
  if (!lead) return { ok: false, error: "That enquiry no longer exists." };

  const now = new Date();
  const claims = !lead.assignedTo;
  await db
    .update(leads)
    .set({
      updatedAt: now,
      ...(lead.firstResponseAt ? {} : { firstResponseAt: now }),
      ...(lead.status === "new" ? { status: "contacted" as const } : {}),
      ...(claims ? { assignedTo: me.id } : {}),
    })
    .where(eq(leads.id, leadId));
  await log(leadId, me, "contacted", CONTACT_METHODS[method] + (claims ? " · took the enquiry" : ""));
  refresh(leadId);
  return { ok: true };
}

const statusSchema = z.object({
  leadId: z.uuid(),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
  // Only sent when "Lost" is chosen; absent otherwise.
  lostReason: z.preprocess((v) => (typeof v !== "string" || v.trim() === "" ? null : v), z.string().trim().max(200).nullable()),
});

/** Moves a lead along: contacted → serious buyer → bought, or lost (with why). */
export async function setLeadStatus(_prev: Result | null, formData: FormData): Promise<Result> {
  const me = await requireStaff();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That change could not be saved." };
  const { leadId, status } = parsed.data;
  const lostReason = status === "lost" ? parsed.data.lostReason : null;
  if (status === "lost" && !lostReason) return { ok: false, error: "Say why it was lost — it is how Sabicars learns what to fix." };

  const lead = await loadLead(me, leadId);
  if (!lead) return { ok: false, error: "That enquiry no longer exists." };
  if (status === lead.status && lostReason === lead.lostReason) return { ok: true };

  const now = new Date();
  const closing = status === "won" || status === "lost";
  // Moving it forward means someone spoke to the buyer, even if not through these buttons.
  const answered = !lead.firstResponseAt && (status === "contacted" || status === "qualified" || status === "won");
  const claims = !lead.assignedTo && status !== "new";
  await db
    .update(leads)
    .set({
      status,
      lostReason,
      closedAt: closing ? (lead.closedAt ?? now) : null,
      updatedAt: now,
      ...(answered ? { firstResponseAt: now } : {}),
      ...(claims ? { assignedTo: me.id } : {}),
      // A sale earns the buyer a private link to review it as a verified buyer.
      ...(status === "won" && !lead.reviewToken ? { reviewToken: randomUUID() } : {}),
    })
    .where(eq(leads.id, leadId));
  await log(
    leadId,
    me,
    "status",
    `${LEAD_STATUS_LABEL[lead.status]} → ${LEAD_STATUS_LABEL[status]}${lostReason ? ` — ${lostReason}` : ""}`,
  );
  await audit(me, "lead", leadId, "status_change", {
    status: [lead.status, status],
    ...(lostReason !== lead.lostReason ? { lostReason: [lead.lostReason, lostReason] } : {}),
  });
  refresh(leadId);
  return { ok: true };
}

const noteSchema = z.object({ leadId: z.uuid(), note: z.string().trim().min(1, "Write the note first.").max(1000) });

/** What was said, promised or learned — so whoever picks it up next knows. */
export async function addLeadNote(_prev: Result | null, formData: FormData): Promise<Result> {
  const me = await requireStaff();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That note could not be saved." };
  const lead = await loadLead(me, parsed.data.leadId);
  if (!lead) return { ok: false, error: "That enquiry no longer exists." };
  await log(lead.id, me, "note", parsed.data.note);
  await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, lead.id));
  refresh(lead.id);
  return { ok: true };
}

/** Staff sent the buyer their review link (the lead page's WhatsApp or copy button). */
export async function recordReviewRequest(leadId: string, how: "whatsapp" | "copied"): Promise<Result> {
  const me = await requireStaff();
  const lead = await loadLead(me, leadId);
  if (!lead || !lead.reviewToken) return { ok: false };
  await log(leadId, me, "review_requested", how === "whatsapp" ? "Asked for a review on WhatsApp" : "Copied the review link");
  refresh(leadId);
  return { ok: true };
}

/* ── Alerts on this phone ─────────────────────────────────────────────── */

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(2000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Registers this phone for alerts. Re-registering the same phone just refreshes it. */
export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<Result> {
  const me = await requireStaff();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "This phone gave an alert address that could not be used." };
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ staffId: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { staffId: me.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) },
    });
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const me = await requireStaff();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.staffId, me.id)));
  revalidatePath("/admin/leads");
  return { ok: true };
}

/** Sends an alert to this person's own phones, to prove the chain works end to end. */
export async function sendTestAlert(): Promise<Result & { sent?: number }> {
  const me = await requireStaff();
  if (!pushConfigured()) return { ok: false, error: "Phone alerts are not set up on the server yet." };
  const { sent } = await pushToStaff([me.id], {
    title: "Sabicars alerts are on",
    body: "New enquiries will arrive on this phone like this — tap one to open it.",
    url: "/admin/leads",
    tag: "test",
  });
  return sent ? { ok: true, sent } : { ok: false, error: "No phone received it. Turn alerts off and on again on this phone." };
}

/** Whether new enquiries alert this person at all. Managers are still told about unanswered ones. */
export async function setMyAlerts(on: boolean): Promise<Result> {
  const me = await requireStaff();
  await db
    .update(staff)
    .set({ receivesAlerts: Boolean(on) })
    .where(eq(staff.id, me.id));
  revalidatePath("/admin/leads");
  return { ok: true };
}
