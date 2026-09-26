import "server-only";
import webpush from "web-push";
import { and, eq, gt, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { leadActivity, leads, pushSubscriptions, staff, vehicles } from "@/db/schema";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { ALERTING_TYPES, LEAD_TYPE_LABEL, RESPONSE_TARGET_MINUTES } from "@/lib/lead-labels";
import { displayPhone } from "@/lib/phone";
import { referenceFor } from "@/lib/reference";
import { showroomHours } from "@/lib/showroom-hours";
import { site, siteUrl } from "@/lib/site";

/**
 * Telling staff, the moment a buyer asks.
 *
 * Push goes straight to staff phones through the browser's own Web Push
 * service — no WhatsApp Business account, no third-party app, no monthly fee.
 * Email follows when a sending key is configured. Nothing here can cost a
 * lead: it is always saved first, and every failure is logged, not thrown.
 */

export interface AlertPayload {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function vapid() {
  if (!vapidSet) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? `mailto:${site.email}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidSet = true;
  }
}

/** Sends to every phone the given staff have subscribed. Expired subscriptions are removed as they are found. */
export async function pushToStaff(staffIds: string[], payload: AlertPayload): Promise<{ sent: number; failed: number }> {
  if (!staffIds.length || !pushConfigured()) return { sent: 0, failed: 0 };
  vapid();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.staffId, staffIds));
  let sent = 0,
    failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60,
          urgency: "high",
        });
        sent++;
        await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(eq(pushSubscriptions.id, sub.id));
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the phone unsubscribed or the browser was reset — the subscription will never work again.
        if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        else console.error("[alerts] push failed", status ?? (e as Error).message);
      }
    }),
  );
  return { sent, failed };
}

async function emailStaff(people: { email: string }[], payload: AlertPayload): Promise<number> {
  if (!emailConfigured() || !people.length) return 0;
  const link = `${siteUrl()}${payload.url}`;
  let sent = 0;
  for (const p of people) {
    const r = await sendEmail({
      to: p.email,
      subject: payload.title,
      text: `${payload.body}\n\nOpen it: ${link}`,
      html: `<!doctype html><html><body style="margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5f2ea"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" style="max-width:520px"><tr><td style="padding-bottom:20px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="180" alt="Sabicars" style="display:block;border:0"></td></tr><tr><td style="font-size:20px;font-weight:bold;padding-bottom:10px">${esc(payload.title)}</td></tr><tr><td style="font-size:15px;line-height:1.6;color:#d6cfc0;padding-bottom:24px">${esc(payload.body)}</td></tr><tr><td><a href="${esc(link)}" style="display:inline-block;background:#c9a84c;color:#0a0908;padding:14px 24px;border-radius:999px;font-weight:bold;text-decoration:none">Open the enquiry</a></td></tr></table></td></tr></table></body></html>`,
    });
    if (r.ok) sent++;
  }
  return sent;
}

/**
 * A lead as an alert: who, what for, how to reach them. `headline` turns
 * "drive plan — Ada Obi" into the title, e.g. "New drive plan — Ada Obi".
 */
async function payloadFor(
  leadId: string,
  headline: (what: string) => string,
): Promise<{ payload: AlertPayload; dealerId: string; type: (typeof leads.$inferSelect)["type"] } | null> {
  const [row] = await db
    .select({ lead: leads, vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model } })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!row) return null;
  const { lead, vehicle } = row;
  const about = vehicle?.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : (lead.message ?? "").split("\n")[0].slice(0, 90);
  const reach = lead.phone ? displayPhone(lead.phone) : (lead.email ?? "");
  return {
    dealerId: lead.dealerId,
    type: lead.type,
    payload: {
      title: headline(`${LEAD_TYPE_LABEL[lead.type].toLowerCase()} — ${lead.name}`),
      body: [about, reach, referenceFor(lead.id)].filter(Boolean).join(" · "),
      url: `/admin/leads/${lead.id}`,
      tag: `lead-${lead.id}`,
    },
  };
}

/** Something only the owner and managers act on — a review to approve, for instance. */
export async function notifyManagers(dealerId: string, payload: AlertPayload): Promise<void> {
  const managers = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.dealerId, dealerId), eq(staff.isActive, true), inArray(staff.role, ["owner", "manager"])));
  await pushToStaff(
    managers.map((m) => m.id),
    payload,
  );
}

/** A lead was handed to someone: tell them, on their phone. */
export async function notifyAssigned(leadId: string, staffId: string, byName: string): Promise<void> {
  const p = await payloadFor(leadId, (what) => `${byName} gave you a ${what}`);
  if (p) await pushToStaff([staffId], p.payload);
}

/** A new lead arrived: alert every active member of staff who takes alerts. */
export async function notifyNewLead(leadId: string): Promise<void> {
  const p = await payloadFor(leadId, (what) => `New ${what}`);
  if (!p || !ALERTING_TYPES.includes(p.type)) return;
  const people = await db
    .select({ id: staff.id, email: staff.email })
    .from(staff)
    .where(and(eq(staff.dealerId, p.dealerId), eq(staff.isActive, true), eq(staff.receivesAlerts, true)));
  const [push, emailed] = await Promise.all([
    pushToStaff(
      people.map((x) => x.id),
      p.payload,
    ),
    emailStaff(people, p.payload),
  ]);
  await db.insert(leadActivity).values({
    leadId,
    kind: "alerted",
    detail: `${people.length} ${people.length === 1 ? "person" : "people"} alerted · ${push.sent} phone${push.sent === 1 ? "" : "s"} · ${emailed} email${emailed === 1 ? "" : "s"}`,
  });
}

/**
 * New leads nobody has answered within the target: tell the owner and
 * managers, once per lead. The clock only runs while the showroom is open —
 * a Saturday-night enquiry escalates fifteen minutes after opening, not at 2am.
 * Safe to run as often as wanted (a cron, a new lead, an inbox load).
 */
export async function escalateStaleLeads(now = new Date()): Promise<number> {
  const target = RESPONSE_TARGET_MINUTES * 60 * 1000;
  const { opens, closes } = showroomHours(now);
  if (now < new Date(opens.getTime() + target) || now >= closes) return 0;
  const cutoff = new Date(now.getTime() - target);
  const stale = await db
    .update(leads)
    .set({ escalatedAt: now })
    .where(
      and(
        eq(leads.status, "new"),
        isNull(leads.firstResponseAt),
        isNull(leads.escalatedAt),
        lte(leads.createdAt, cutoff),
        inArray(leads.type, ALERTING_TYPES),
        // Legacy enquiries were answered in the old system; they are history, not work.
        ne(leads.channel, "legacy_import"),
        // A lead days old is a missed lead to review in the inbox, not an alarm to sound now.
        gt(leads.createdAt, new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
      ),
    )
    .returning({ id: leads.id, dealerId: leads.dealerId });

  for (const lead of stale) {
    const p = await payloadFor(lead.id, (what) => `No reply in ${RESPONSE_TARGET_MINUTES} min: ${what}`);
    if (!p) continue;
    const managers = await db
      .select({ id: staff.id, email: staff.email })
      .from(staff)
      .where(and(eq(staff.dealerId, lead.dealerId), eq(staff.isActive, true), inArray(staff.role, ["owner", "manager"])));
    const [push, emailed] = await Promise.all([
      pushToStaff(
        managers.map((m) => m.id),
        p.payload,
      ),
      emailStaff(managers, p.payload),
    ]);
    await db.insert(leadActivity).values({
      leadId: lead.id,
      kind: "escalated",
      detail: `No reply within ${RESPONSE_TARGET_MINUTES} minutes — managers alerted (${push.sent} phone${push.sent === 1 ? "" : "s"}, ${emailed} email${emailed === 1 ? "" : "s"})`,
    });
  }
  return stale.length;
}
