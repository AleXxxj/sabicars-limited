import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, locations, settings, staff, vehicles } from "@/db/schema";
import { pushToStaff } from "@/lib/alerts";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { referenceFor } from "@/lib/reference";
import { showroomHours } from "@/lib/showroom-hours";
import { site, siteUrl, whatsappLink } from "@/lib/site";
import { calendarFileUrl, googleCalendarUrl, slotLabel } from "@/lib/viewings";

const time = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

/** What the page said when the viewing was booked for a car held elsewhere; the emails and the calendar file say the same. */
export const OFFSITE_PLACE = "a place the Sabicars team will confirm with you";

/**
 * Where a viewing happens, in words: the car's own park, the showroom, or —
 * for a car Sabicars holds elsewhere — a place agreed with the buyer. One
 * function, so the booking confirmation, the calendar file and the morning
 * reminder can never name three different places.
 */
export function viewingPlace(vehicle: { heldOffsite: boolean } | null, location: { line1: string | null; line2: string | null; city: string | null } | null): string {
  if (vehicle?.heldOffsite) return OFFSITE_PLACE;
  if (location?.line1) return [location.line1, location.line2, location.city].filter(Boolean).join(", ");
  return `${site.address.line1}, ${site.address.line2}, ${site.address.city}`;
}

export interface ViewingRecord {
  id: string;
  reference: string;
  name: string;
  email: string | null;
  at: Date;
  title: string;
  slug: string | null;
  where: string;
  offsite: boolean;
  /** A map link to the place, or null when the place is still to be agreed. */
  directions: string | null;
}

/** Directions to wherever the viewing is: the showroom's own link, or a map search for the car's park. */
function directionsTo(vehicle: { heldOffsite: boolean } | null, location: { line1: string | null } | null): string | null {
  if (vehicle?.heldOffsite) return null;
  if (location?.line1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewingPlace(vehicle, location as { line1: string | null; line2: string | null; city: string | null }))}`;
  return site.mapsUrl;
}

async function viewingWhere(condition: SQL): Promise<ViewingRecord | null> {
  const [row] = await db
    .select({
      lead: { id: leads.id, name: leads.name, email: leads.email, viewingAt: leads.viewingAt },
      vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug, heldOffsite: vehicles.heldOffsite },
      location: { line1: locations.addressLine1, line2: locations.addressLine2, city: locations.city },
    })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .leftJoin(locations, eq(locations.id, vehicles.locationId))
    .where(and(eq(leads.type, "viewing"), ne(leads.status, "lost"), condition))
    // Should two leads ever share a reference's six characters, the newer booking is the one being asked for.
    .orderBy(desc(leads.createdAt))
    .limit(1);
  if (!row?.lead.viewingAt) return null;
  return {
    id: row.lead.id,
    reference: referenceFor(row.lead.id),
    name: row.lead.name,
    email: row.lead.email,
    at: row.lead.viewingAt,
    title: row.vehicle ? `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}` : "the vehicle",
    slug: row.vehicle?.slug ?? null,
    where: viewingPlace(row.vehicle, row.location),
    offsite: Boolean(row.vehicle?.heldOffsite),
    directions: directionsTo(row.vehicle, row.location),
  };
}

/**
 * A booked viewing by the reference the buyer was shown ("SC-" and the first
 * six characters of the lead id), for the calendar file. Null for anything
 * that is not a live viewing.
 */
export async function viewingByReference(reference: string): Promise<ViewingRecord | null> {
  const hex = /^SC-([0-9A-F]{6})$/i.exec(reference.trim())?.[1]?.toLowerCase();
  if (!hex) return null;
  return viewingWhere(sql`left(replace(${leads.id}::text, '-', ''), 6) = ${hex}`);
}

/**
 * The buyer's copy of a booking, sent the moment it is made: the time, the
 * place, the reference and the calendar links. People screenshot the
 * thank-you screen; an hour later it is the email they look for. By the
 * lead's id, never its reference, and keyed by the lead, so a retry can
 * never send it twice.
 */
export async function confirmViewingByEmail(leadId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "not_configured" };
  const v = await viewingWhere(eq(leads.id, leadId));
  if (!v) return { ok: false, error: "no_such_viewing" };
  if (!v.email) return { ok: false, error: "no_email" };
  return sendEmail(confirmationEmail(v), { dedupeKey: `viewing-confirmation:${v.id}` });
}

/**
 * The morning of a viewing day: each buyer with an email is reminded (once),
 * and staff get the day's list on their phones (once a day). Run it on a timer
 * before opening; running it again the same day sends nothing twice.
 */
export async function remindTodaysViewings(now = new Date()): Promise<{ viewings: number; emailed: number; staffAlerted: number }> {
  const { opens, closes } = showroomHours(now);
  const rows = await db
    .select({
      lead: leads,
      vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug, heldOffsite: vehicles.heldOffsite },
      location: { line1: locations.addressLine1, line2: locations.addressLine2, city: locations.city },
    })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .leftJoin(locations, eq(locations.id, vehicles.locationId))
    .where(and(eq(leads.type, "viewing"), gte(leads.viewingAt, opens), lt(leads.viewingAt, closes), ne(leads.status, "lost")))
    .orderBy(asc(leads.viewingAt));

  let emailed = 0;
  if (emailConfigured()) {
    for (const { lead, vehicle, location } of rows) {
      if (!lead.email || lead.viewingRemindedAt || !lead.viewingAt) continue;
      // Claim the reminder before sending: of two runs at the same moment, only one gets the row.
      const claimed = await db
        .update(leads)
        .set({ viewingRemindedAt: new Date() })
        .where(and(eq(leads.id, lead.id), isNull(leads.viewingRemindedAt)))
        .returning({ id: leads.id });
      if (!claimed.length) continue;
      const record: ViewingRecord = {
        id: lead.id,
        reference: referenceFor(lead.id),
        name: lead.name,
        email: lead.email,
        at: lead.viewingAt,
        title: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "the vehicle",
        slug: vehicle?.slug ?? null,
        // The same place the booking confirmation gave: the car's own park, or the showroom.
        where: viewingPlace(vehicle, location),
        offsite: Boolean(vehicle?.heldOffsite),
        directions: directionsTo(vehicle, location),
      };
      // Keyed by the lead and the viewing time: if the claim is released and the next run tries again,
      // an email already queued for this viewing is not queued a second time.
      const sent = await sendEmail(reminderEmail(record), { dedupeKey: `viewing-reminder:${lead.id}:${lead.viewingAt.toISOString()}` });
      if (sent.ok) {
        emailed++;
      } else {
        // Not sent: release the claim so the next run tries again.
        await db.update(leads).set({ viewingRemindedAt: null }).where(eq(leads.id, lead.id));
        console.error("[viewings] reminder failed", lead.id, sent.error);
      }
    }
  }

  // Staff hear about the day once, per dealer.
  let staffAlerted = 0;
  const day = opens.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  for (const dealerId of [...new Set(rows.map((r) => r.lead.dealerId))]) {
    const key = `viewings_digest:${day}`;
    const claimed = await db
      .insert(settings)
      .values({ dealerId, key, value: { at: now.toISOString() } })
      .onConflictDoNothing()
      .returning({ key: settings.key });
    if (!claimed.length) continue;
    const today = rows.filter((r) => r.lead.dealerId === dealerId);
    const people = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.dealerId, dealerId), eq(staff.isActive, true), eq(staff.receivesAlerts, true)));
    const push = await pushToStaff(
      people.map((p) => p.id),
      {
        title: `${today.length} viewing${today.length === 1 ? "" : "s"} today`,
        body: today
          .map((r) => `${time(r.lead.viewingAt!)} ${r.lead.name.split(" ")[0]}${r.vehicle ? ` · ${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : ""}`)
          .join("; "),
        url: "/admin/leads?view=all",
        tag: key,
      },
    );
    staffAlerted += push.sent;
  }
  return { viewings: rows.length, emailed, staffAlerted };
}

/** A button in the email: orange for the one action, outlined for the rest. */
function emailButton(label: string, href: string, primary: boolean) {
  const look = primary ? "background:#F7801E;color:#090E0A;" : "border:1px solid #3A4536;color:#F2F2EC;";
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 10px 10px 0;${look}padding:15px 26px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">${esc(label)}</a>`;
}

/**
 * The two viewing emails share one shape: who, when (large), what and where,
 * the buttons, how to change plans, the reference.
 */
function viewingEmail(v: ViewingRecord, o: { kicker: string; subject: string; intro: string; actions: { label: string; href: string; primary?: boolean }[] }) {
  const first = v.name.trim().split(/\s+/)[0];
  const url = v.slug ? `${siteUrl()}/vehicles/${v.slug}` : siteUrl();
  const change = whatsappLink(`Hello Sabicars, about my viewing (reference ${v.reference}).`);
  const text = [
    `Hello ${first},`,
    ``,
    `${o.intro} ${slotLabel(v.at)}, to see the ${v.title}.`,
    `Where: ${v.where}.`,
    ...o.actions.map((a) => `${a.label}: ${a.href}`),
    `Bring your mechanic if you like. If your plans change, tell us on WhatsApp: ${change}`,
    ``,
    `Reference ${v.reference}.`,
    `${site.legalName} · CAC RC ${site.rcNumber}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#090E0A;font-family:Helvetica,Arial,sans-serif;color:#F2F2EC">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090E0A"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="220" height="45" alt="Sabicars" style="display:block;border:0"><div style="padding-top:14px;font-size:12px;letter-spacing:3px;color:#8DC74D">${esc(o.kicker)}</div></td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#CFD2CC">Hello ${esc(first)},</td></tr>
<tr><td style="padding:12px 0 0;font-weight:bold;letter-spacing:-0.4px;font-size:26px;line-height:1.2;color:#F2F2EC">${esc(slotLabel(v.at))}</td></tr>
<tr><td style="padding:8px 0 0;font-size:16px;line-height:1.6;color:#CFD2CC">To see the <a href="${esc(url)}" style="color:#A5DB6F">${esc(v.title)}</a> at ${esc(v.where)}. Bring your mechanic if you like.</td></tr>
<tr><td style="padding:28px 0 18px">${o.actions.map((a) => emailButton(a.label, a.href, Boolean(a.primary))).join("")}</td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#CFD2CC">Plans changed? <a href="${esc(change)}" style="color:#A5DB6F">Tell us on WhatsApp</a>.</td></tr>
<tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:#9FA59E">Reference ${esc(v.reference)}.<br><br>${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: v.email ?? "", subject: o.subject, html, text, replyTo: site.email };
}

/** For a car held elsewhere: the way to settle where to meet. */
const askWhere = (v: ViewingRecord) => ({ label: "Ask where to meet", href: whatsappLink(`Hello Sabicars, where do we meet for my viewing (reference ${v.reference})?`), primary: true });

/** Sent the moment a viewing is booked. */
function confirmationEmail(v: ViewingRecord) {
  return viewingEmail(v, {
    kicker: "VIEWING BOOKED",
    subject: `Your Sabicars viewing: ${slotLabel(v.at)}`,
    intro: "Your viewing is booked for",
    actions: [
      // An email cannot tell which phone reads it, so the file leads and Google Calendar is offered beside it.
      { label: "Add to my calendar", href: `${siteUrl()}${calendarFileUrl(v.reference)}`, primary: true },
      { label: "Google Calendar", href: googleCalendarUrl(v.at, v.title, v.where, v.reference) },
      ...(v.directions ? [{ label: "Directions", href: v.directions }] : [askWhere(v)]),
    ],
  });
}

/** Sent on the morning of the viewing. */
function reminderEmail(v: ViewingRecord) {
  return viewingEmail(v, {
    kicker: "YOUR VIEWING TODAY",
    subject: `Your Sabicars viewing today at ${time(v.at)}`,
    intro: "This is a reminder of your viewing today,",
    actions: v.directions ? [{ label: "Directions", href: v.directions, primary: true }] : [askWhere(v)],
  });
}

/** Today's viewings, for the staff screens, earliest first. */
export async function viewingsOn(dealerId: string, now = new Date()) {
  const { opens, closes } = showroomHours(now);
  return db
    .select({ id: leads.id, name: leads.name, viewingAt: leads.viewingAt, status: leads.status, vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model } })
    .from(leads)
    .leftJoin(vehicles, eq(vehicles.id, leads.vehicleId))
    .where(and(eq(leads.dealerId, dealerId), eq(leads.type, "viewing"), inArray(leads.status, ["new", "contacted", "qualified"]), gte(leads.viewingAt, opens), lt(leads.viewingAt, closes)))
    .orderBy(asc(leads.viewingAt));
}
