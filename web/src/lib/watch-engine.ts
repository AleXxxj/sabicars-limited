import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, vehicleMedia, vehicles, vehicleWatches } from "@/db/schema";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { referenceFor } from "@/lib/leads";
import { shareImageUrl } from "@/lib/media";
import { formatNaira } from "@/lib/money";
import { site, siteUrl } from "@/lib/site";
import { drivePlanDeposit, vehicleTitle } from "@/lib/vehicle";

/**
 * Price drops, announced to the people watching. Runs after staff save a
 * vehicle; safe to run on every save — a buyer is only told about a price
 * below the last one they knew, and never twice about the same price.
 */
export async function announcePriceDrop(vehicleId: string): Promise<{ due: number; emailed: number }> {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v || v.status !== "available" || !v.priceMinor) return { due: 0, emailed: 0 };

  const due = await db
    .update(vehicleWatches)
    .set({ pendingPriceMinor: v.priceMinor, alertStatus: "pending", alertError: null, alertChannel: null })
    .where(
      and(
        eq(vehicleWatches.vehicleId, v.id),
        sql`(${vehicleWatches.knownPriceMinor} IS NULL OR ${vehicleWatches.knownPriceMinor} > ${v.priceMinor})`,
        // Already waiting (or failed) at this very price: it is on the staff board.
        sql`${vehicleWatches.pendingPriceMinor} IS DISTINCT FROM ${v.priceMinor}`,
      ),
    )
    .returning({ id: vehicleWatches.id });

  let emailed = 0;
  for (const w of due) if ((await deliverPriceDrop(w.id)) === "sent") emailed++;
  return { due: due.length, emailed };
}

async function deliverPriceDrop(watchId: string): Promise<"sent" | "pending" | "failed"> {
  const [row] = await db
    .select({ watch: vehicleWatches, leadId: leads.id, name: leads.name, email: leads.email, vehicle: vehicles })
    .from(vehicleWatches)
    .innerJoin(leads, eq(leads.id, vehicleWatches.leadId))
    .innerJoin(vehicles, eq(vehicles.id, vehicleWatches.vehicleId))
    .where(eq(vehicleWatches.id, watchId))
    .limit(1);
  if (!row || row.watch.alertStatus !== "pending" || !row.watch.pendingPriceMinor) return "pending";
  if (!row.email || !emailConfigured()) return "pending";

  const [cover] = await db
    .select({ url: vehicleMedia.url })
    .from(vehicleMedia)
    .where(and(eq(vehicleMedia.vehicleId, row.vehicle.id), eq(vehicleMedia.position, 0)))
    .limit(1);
  const title = vehicleTitle(row.vehicle);
  const was = row.watch.knownPriceMinor;
  const now = row.watch.pendingPriceMinor;
  const url = `${siteUrl()}/vehicles/${row.vehicle.slug}?utm_source=price_alert&utm_medium=email`;
  const deposit = drivePlanDeposit(row.vehicle);
  const reference = referenceFor(row.leadId);

  const subject = was ? `Price drop: the ${title} is now ${formatNaira(now)}` : `The ${title} now has a price: ${formatNaira(now)}`;
  const text = [
    `Hello ${row.name.split(" ")[0]},`,
    ``,
    was ? `The ${title} you are watching has dropped from ${formatNaira(was)} to ${formatNaira(now)}.` : `The ${title} you are watching is now priced at ${formatNaira(now)}.`,
    deposit ? `On the 40% Drive Plan that is ${deposit} down.` : "",
    url,
    ``,
    `Reference ${reference}. Bought elsewhere? Reply and we will stop these alerts.`,
    `${site.legalName} · CAC RC ${site.rcNumber}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5f2ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0908"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 24px;font-size:13px;letter-spacing:4px;color:#c9a84c">SABICARS · PRICE ALERT</td></tr>
${cover ? `<tr><td><a href="${esc(url)}"><img src="${esc(shareImageUrl(cover.url))}" width="560" alt="${esc(title)}" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></a></td></tr>` : ""}
<tr><td style="padding:20px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.2">${esc(title)}</td></tr>
<tr><td style="padding:10px 0 0;font-size:20px">${was ? `<span style="color:#aba394;text-decoration:line-through">${esc(formatNaira(was))}</span>&nbsp; ` : ""}<strong style="color:#dfc67c">${esc(formatNaira(now))}</strong></td></tr>
${deposit ? `<tr><td style="padding:6px 0 0;font-size:14px;color:#d6cfc0">${esc(deposit)} down on the 40% Drive Plan</td></tr>` : ""}
<tr><td style="padding:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#c9a84c;color:#0a0908;padding:16px 28px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">See the vehicle</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#aba394">Reference ${esc(reference)}. Bought elsewhere? Reply and we will stop these alerts.<br><br>${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}</td></tr>
</table></td></tr></table></body></html>`;

  const result = await sendEmail({ to: row.email, subject, html, text, replyTo: site.email });
  await db
    .update(vehicleWatches)
    .set(
      result.ok
        ? { alertStatus: "sent", alertChannel: "email", alertedAt: new Date(), alertError: null, knownPriceMinor: now }
        : { alertStatus: "failed", alertChannel: "email", alertError: result.error },
    )
    .where(eq(vehicleWatches.id, watchId));
  return result.ok ? "sent" : "failed";
}

/** The WhatsApp words staff send when an alert could not go automatically. */
export function priceDropWhatsAppText(m: { firstName: string; title: string; was: number | null; now: number; url: string }): string {
  return m.was
    ? `Hello ${m.firstName}, this is Sabicars. The ${m.title} you asked us to watch has dropped from ${formatNaira(m.was)} to ${formatNaira(m.now)}. See it here: ${m.url}`
    : `Hello ${m.firstName}, this is Sabicars. The ${m.title} you asked us to watch now has a price: ${formatNaira(m.now)}. See it here: ${m.url}`;
}

