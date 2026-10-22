import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { leads, locations, settings, staff, vehicles } from "@/db/schema";
import { pushToStaff } from "@/lib/alerts";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { referenceFor } from "@/lib/reference";
import { showroomHours } from "@/lib/showroom-hours";
import { site, siteUrl, whatsappLink } from "@/lib/site";
import { slotLabel } from "@/lib/viewings";

const time = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

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
      vehicle: { year: vehicles.year, make: vehicles.make, model: vehicles.model, slug: vehicles.slug },
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
      const title = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "the vehicle";
      // The same address the booking confirmation gave: the car's own park, or the showroom.
      const where = location?.line1
        ? [location.line1, location.line2, location.city].filter(Boolean).join(", ")
        : `${site.address.line1}, ${site.address.line2}, ${site.address.city}`;
      // Keyed by the lead and the viewing time: if the claim is released and the next run tries again,
      // an email already queued for this viewing is not queued a second time.
      const sent = await sendEmail(reminderEmail(lead.email, lead.name, lead.viewingAt, title, vehicle?.slug ?? null, referenceFor(lead.id), where), {
        dedupeKey: `viewing-reminder:${lead.id}:${lead.viewingAt.toISOString()}`,
      });
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

function reminderEmail(to: string, name: string, at: Date, title: string, slug: string | null, reference: string, where: string) {
  const first = name.trim().split(/\s+/)[0];
  const url = slug ? `${siteUrl()}/vehicles/${slug}` : siteUrl();
  const change = `${whatsappLink(`Hello Sabicars, about my viewing today (reference ${reference}).`)}`;
  const subject = `Your Sabicars viewing today at ${time(at)}`;
  const text = [
    `Hello ${first},`,
    ``,
    `This is a reminder of your viewing today, ${slotLabel(at)}, to see the ${title}.`,
    `Where: ${where}. Directions: ${site.mapsUrl}`,
    `Bring your mechanic if you like. If your plans change, tell us on WhatsApp: ${change}`,
    ``,
    `Reference ${reference}.`,
    `${site.legalName} · CAC RC ${site.rcNumber}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#090E0A;font-family:Helvetica,Arial,sans-serif;color:#F2F2EC">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090E0A"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="220" height="45" alt="Sabicars" style="display:block;border:0"><div style="padding-top:14px;font-size:12px;letter-spacing:3px;color:#8DC74D">YOUR VIEWING TODAY</div></td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#CFD2CC">Hello ${esc(first)},</td></tr>
<tr><td style="padding:12px 0 0;font-weight:bold;letter-spacing:-0.4px;font-size:26px;line-height:1.2;color:#F2F2EC">${esc(slotLabel(at))}</td></tr>
<tr><td style="padding:8px 0 0;font-size:16px;line-height:1.6;color:#CFD2CC">To see the <a href="${esc(url)}" style="color:#A5DB6F">${esc(title)}</a> at ${esc(where)}. Bring your mechanic if you like.</td></tr>
<tr><td style="padding:28px 0"><a href="${esc(site.mapsUrl)}" style="display:inline-block;background:#F7801E;color:#090E0A;padding:16px 28px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">Directions to the showroom</a></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#CFD2CC">Plans changed? <a href="${esc(change)}" style="color:#A5DB6F">Tell us on WhatsApp</a>.</td></tr>
<tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:#9FA59E">Reference ${esc(reference)}.<br><br>${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, html, text, replyTo: site.email };
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
