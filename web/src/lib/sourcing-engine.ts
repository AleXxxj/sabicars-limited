import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, requestMatches, vehicleMedia, vehicleRequests, vehicles } from "@/db/schema";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { referenceFor } from "@/lib/leads";
import { satisfies } from "@/lib/matching";
import { shareImageUrl } from "@/lib/media";
import { site, siteUrl } from "@/lib/site";
import { drivePlanDeposit, priceLabel, vehicleTitle } from "@/lib/vehicle";

/**
 * The Sourcing Desk's engine: when a vehicle goes on sale, every buyer who
 * asked for one like it is told — without anyone having to remember who
 * asked. Runs after the staff member's save has already returned, so a slow
 * email provider never slows the admin down.
 */

/** Requests still waiting for a car. */
const ACTIVE = ["open", "sourcing", "matched"] as const;

/**
 * Offers a vehicle to every active request it satisfies, once per request,
 * and tries to tell each buyer. Safe to call on every save: a request that
 * was already offered this vehicle is skipped.
 */
export async function offerVehicle(vehicleId: string): Promise<{ offered: number; emailed: number }> {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v || v.status !== "available") return { offered: 0, emailed: 0 };

  const active = await db
    .select({ id: vehicleRequests.id, want: vehicleRequests.want, yearFrom: vehicleRequests.yearFrom, budgetMaxMinor: vehicleRequests.budgetMaxMinor })
    .from(vehicleRequests)
    .where(and(eq(vehicleRequests.dealerId, v.dealerId), inArray(vehicleRequests.status, [...ACTIVE])));
  const answered = active.filter((r) => satisfies(v, r));
  if (!answered.length) return { offered: 0, emailed: 0 };

  const created = await db
    .insert(requestMatches)
    .values(answered.map((r) => ({ requestId: r.id, vehicleId })))
    .onConflictDoNothing()
    .returning({ id: requestMatches.id, requestId: requestMatches.requestId });
  if (!created.length) return { offered: 0, emailed: 0 };

  await db
    .update(vehicleRequests)
    .set({
      // A request staff closed or fulfilled is never reopened by a match.
      status: sql`CASE WHEN ${vehicleRequests.status} IN ('open', 'sourcing') THEN 'matched'::request_status ELSE ${vehicleRequests.status} END`,
      lastMatchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(vehicleRequests.id, created.map((m) => m.requestId)));

  let emailed = 0;
  for (const m of created) if ((await deliverMatch(m.id)) === "sent") emailed++;
  return { offered: created.length, emailed };
}

/**
 * Tries each automatic channel the buyer can be reached on. Today that is
 * email; WhatsApp and SMS slot in here once their business accounts exist.
 * Whatever cannot be sent stays "pending" and appears on the staff board with
 * a ready-written WhatsApp message — one tap, not a memory test.
 */
export async function deliverMatch(matchId: string): Promise<"sent" | "pending" | "failed"> {
  const [row] = await db
    .select({
      match: requestMatches,
      want: vehicleRequests.want,
      leadId: leads.id,
      name: leads.name,
      email: leads.email,
      vehicle: vehicles,
    })
    .from(requestMatches)
    .innerJoin(vehicleRequests, eq(vehicleRequests.id, requestMatches.requestId))
    .innerJoin(leads, eq(leads.id, vehicleRequests.leadId))
    .innerJoin(vehicles, eq(vehicles.id, requestMatches.vehicleId))
    .where(eq(requestMatches.id, matchId))
    .limit(1);
  if (!row || row.match.status !== "pending") return row?.match.status === "sent" ? "sent" : "pending";

  if (!row.email || !emailConfigured()) return "pending";

  const [cover] = await db
    .select({ url: vehicleMedia.url })
    .from(vehicleMedia)
    .where(and(eq(vehicleMedia.vehicleId, row.vehicle.id), eq(vehicleMedia.position, 0)))
    .limit(1);
  const message = matchEmail({
    firstName: row.name.split(" ")[0],
    want: row.want,
    reference: referenceFor(row.leadId),
    title: vehicleTitle(row.vehicle),
    price: priceLabel(row.vehicle),
    deposit: drivePlanDeposit(row.vehicle),
    url: `${siteUrl()}/vehicles/${row.vehicle.slug}?utm_source=sourcing_desk&utm_medium=email`,
    imageUrl: cover ? shareImageUrl(cover.url) : null,
  });
  const result = await sendEmail({ to: row.email, replyTo: site.email, ...message });

  await db
    .update(requestMatches)
    .set(result.ok ? { status: "sent", channel: "email", sentAt: new Date(), error: null } : { status: "failed", channel: "email", error: result.error })
    .where(eq(requestMatches.id, matchId));
  if (!result.ok) console.error("[sourcing] match email failed", matchId, result.error);
  return result.ok ? "sent" : "failed";
}

/** The words staff send on WhatsApp when a match could not be sent automatically. */
export function matchWhatsAppText(m: { firstName: string; title: string; price: string; reference: string; url: string }): string {
  return `Hello ${m.firstName}, this is Sabicars. A ${m.title} (${m.price}) that matches your request ${m.reference} has just arrived. See it here: ${m.url}`;
}

function matchEmail(m: {
  firstName: string;
  want: string;
  reference: string;
  title: string;
  price: string;
  deposit: string | null;
  url: string;
  imageUrl: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `It’s here: a ${m.title} for your request ${m.reference}`;
  const text = [
    `Hello ${m.firstName},`,
    ``,
    `You asked Sabicars to find a ${m.want} (reference ${m.reference}). One has just arrived:`,
    ``,
    `${m.title} — ${m.price}${m.deposit ? ` (${m.deposit} deposit on the 40% Drive Plan)` : ""}`,
    m.url,
    ``,
    `Found your car already? Reply to this email and we will close your request.`,
    ``,
    `${site.legalName} · CAC RC ${site.rcNumber}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#0b0a09;font-family:Helvetica,Arial,sans-serif;color:#f3eee4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0a09"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="220" height="45" alt="Sabicars" style="display:block;border:0"><div style="padding-top:14px;font-size:12px;letter-spacing:3px;color:#c9a84c">SOURCING DESK</div></td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#d8d0c1">Hello ${esc(m.firstName)},<br><br>You asked us to find a <strong style="color:#f3eee4">${esc(m.want)}</strong> (reference ${esc(m.reference)}). One has just arrived.</td></tr>
${m.imageUrl ? `<tr><td style="padding:24px 0 0"><a href="${esc(m.url)}"><img src="${esc(m.imageUrl)}" width="560" alt="${esc(m.title)}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:20px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#f3eee4">${esc(m.title)}</td></tr>
<tr><td style="padding:8px 0 0;font-size:18px;color:#f3eee4"><strong>${esc(m.price)}</strong>${m.deposit ? `<span style="color:#c9a84c"> · ${esc(m.deposit)} deposit on the 40% Drive Plan</span>` : ""}</td></tr>
<tr><td style="padding:28px 0"><a href="${esc(m.url)}" style="display:inline-block;background:#c9a84c;color:#0b0a09;padding:16px 28px;font-size:13px;font-weight:bold;letter-spacing:2px;text-decoration:none">SEE THE VEHICLE</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#a39b8b">Found your car already? Reply to this email and we will close your request.<br><br>${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
