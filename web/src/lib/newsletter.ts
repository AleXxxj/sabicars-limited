import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSends, subscribers, vehicleMedia, vehicles } from "@/db/schema";
import { emailConfigured, esc, sendBatch, sendEmail, type EmailMessage } from "@/lib/email";
import { shareImageUrl } from "@/lib/media";
import { formatNaira } from "@/lib/money";
import { site, siteUrl } from "@/lib/site";
import { drivePlanDeposit, vehicleTitle } from "@/lib/vehicle";

/**
 * The newsletter, running itself.
 *
 * Every Friday morning the week's new arrivals go to everyone subscribed; a
 * week with none sends nothing. Staff can also send a broadcast — an offer, an
 * event — from the admin. Every email carries a one-click unsubscribe, the
 * thing the old newsletter lacked and mail providers now expect.
 */

export interface EmailVehicle {
  id: string;
  title: string;
  slug: string;
  priceMinor: number | null;
  coverUrl: string | null;
}

async function withCovers(
  rows: { id: string; year: number; make: string; model: string; slug: string; priceMinor: number | null }[],
): Promise<EmailVehicle[]> {
  if (!rows.length) return [];
  const covers = await db
    .select({ vehicleId: vehicleMedia.vehicleId, url: vehicleMedia.url })
    .from(vehicleMedia)
    .where(
      and(
        inArray(
          vehicleMedia.vehicleId,
          rows.map((r) => r.id),
        ),
        eq(vehicleMedia.position, 0),
      ),
    );
  const coverOf = new Map(covers.map((c) => [c.vehicleId, c.url]));
  return rows.map((r) => ({
    id: r.id,
    title: vehicleTitle(r),
    slug: r.slug,
    priceMinor: r.priceMinor,
    coverUrl: coverOf.get(r.id) ?? null,
  }));
}

const cardColumns = {
  id: vehicles.id,
  year: vehicles.year,
  make: vehicles.make,
  model: vehicles.model,
  slug: vehicles.slug,
  priceMinor: vehicles.priceMinor,
};

/** Available vehicles listed since `since`, newest first — the week's arrivals. */
export async function arrivalsSince(dealerId: string, since: Date, limit = 8): Promise<EmailVehicle[]> {
  const rows = await db
    .select(cardColumns)
    .from(vehicles)
    .where(
      and(
        eq(vehicles.dealerId, dealerId),
        eq(vehicles.status, "available"),
        isNotNull(vehicles.publishedAt),
        gte(vehicles.publishedAt, since),
      ),
    )
    .orderBy(desc(vehicles.publishedAt))
    .limit(limit);
  return withCovers(rows);
}

export async function vehiclesByIds(dealerId: string, ids: string[]): Promise<EmailVehicle[]> {
  if (!ids.length) return [];
  const rows = await db
    .select(cardColumns)
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, dealerId), inArray(vehicles.id, ids), eq(vehicles.status, "available")));
  const order = new Map(ids.map((id, i) => [id, i]));
  return withCovers(rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
}

/* ── The template ──────────────────────────────────────────────────────── */

export interface NewsletterContent {
  kicker: string;
  headline: string;
  /** Plain paragraphs, separated by blank lines. */
  intro: string;
  vehicles: EmailVehicle[];
  cta?: { label: string; url: string };
  /** utm_campaign on every link, so the site can tell which email sold what. */
  campaign: string;
}

const tagged = (path: string, campaign: string) =>
  `${siteUrl()}${path}${path.includes("?") ? "&" : "?"}utm_source=newsletter&utm_medium=email&utm_campaign=${encodeURIComponent(campaign)}`;

/** One email, for one subscriber (the unsubscribe link is theirs alone). */
export function renderNewsletter(c: NewsletterContent, unsubscribeUrl: string): { html: string; text: string } {
  const paragraphs = c.intro
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const cars = c.vehicles.map((v) => {
    const url = tagged(`/vehicles/${v.slug}`, c.campaign);
    const price = v.priceMinor ? formatNaira(v.priceMinor) : "Price on request";
    const deposit = drivePlanDeposit(v);
    return {
      text: `${v.title} — ${price}${deposit ? ` (${deposit} down on the 40% Drive Plan)` : ""}\n${url}`,
      html: `<tr><td style="padding:0 0 28px">
${v.coverUrl ? `<a href="${esc(url)}"><img src="${esc(shareImageUrl(v.coverUrl))}" width="560" alt="${esc(v.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:14px"></a>` : ""}
<div style="padding:14px 0 0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#f5f2ea">${esc(v.title)}</div>
<div style="padding:6px 0 0;font-size:17px;color:#dfc67c;font-weight:bold">${esc(price)}</div>
${deposit ? `<div style="padding:2px 0 0;font-size:14px;color:#aba394">${esc(deposit)} down on the 40% Drive Plan</div>` : ""}
<div style="padding:12px 0 0"><a href="${esc(url)}" style="color:#dfc67c;font-size:15px;font-weight:bold;text-decoration:none">See the vehicle &rarr;</a></div>
</td></tr>`,
    };
  });
  const cta = c.cta
    ? { label: c.cta.label, url: tagged(c.cta.url, c.campaign) }
    : { label: "See everything in stock", url: tagged("/vehicles", c.campaign) };
  const legal = `${site.legalName} · CAC RC ${site.rcNumber} · ${site.address.line1}, ${site.address.line2}, ${site.address.city}`;

  const html = `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#0a0908;font-family:Helvetica,Arial,sans-serif;color:#f5f2ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0908"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><a href="${esc(tagged("/", c.campaign))}"><img src="${esc(siteUrl())}/brand/logo-email.png" width="200" alt="Sabicars" style="display:block;border:0"></a></td></tr>
<tr><td style="font-size:12px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase">${esc(c.kicker)}</td></tr>
<tr><td style="padding:10px 0 0;font-family:Georgia,serif;font-size:32px;line-height:1.15;color:#f5f2ea">${esc(c.headline)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding:14px 0 0;font-size:16px;line-height:1.65;color:#d6cfc0">${esc(p)}</td></tr>`).join("\n")}
<tr><td style="padding:28px 0 0"></td></tr>
${cars.map((x) => x.html).join("\n")}
<tr><td style="padding:4px 0 36px"><a href="${esc(cta.url)}" style="display:inline-block;background:#c9a84c;color:#0a0908;padding:16px 28px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">${esc(cta.label)}</a></td></tr>
<tr><td style="border-top:1px solid #2a2825;padding:24px 0 0;font-size:12px;line-height:1.7;color:#8a8376">You are receiving this because you subscribed at sabicars.com. <a href="${esc(unsubscribeUrl)}" style="color:#aba394">Unsubscribe</a> — one click, no questions.<br>${esc(legal)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.headline,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...cars.flatMap((x) => [x.text, ""]),
    `${cta.label}: ${cta.url}`,
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
    legal,
  ].join("\n");
  return { html, text };
}

export const unsubscribeUrl = (token: string) => `${siteUrl()}/unsubscribe/${token}`;

function messageFor(sub: { email: string; unsubscribeToken: string }, subject: string, content: NewsletterContent): EmailMessage {
  const url = unsubscribeUrl(sub.unsubscribeToken);
  const { html, text } = renderNewsletter(content, url);
  return {
    to: sub.email,
    subject,
    html,
    text,
    replyTo: site.email,
    // One-click unsubscribe from the mail app itself (RFC 8058).
    headers: {
      "List-Unsubscribe": `<${siteUrl()}/api/unsubscribe/${sub.unsubscribeToken}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/* ── Sending ───────────────────────────────────────────────────────────── */

/** The content of a recorded send, rebuilt from what was stored. */
async function contentOf(send: typeof newsletterSends.$inferSelect): Promise<NewsletterContent> {
  const cars = await vehiclesByIds(send.dealerId, send.vehicleIds);
  if (send.kind === "digest") {
    return {
      kicker: "New this week",
      headline: cars.length === 1 ? "One new arrival at Sabicars." : `${cars.length} new arrivals at Sabicars.`,
      intro:
        "Photographed, priced and ready to inspect at the showroom. Every one can be bought outright or on the 40% Drive Plan — you pay 40%, Autochek finances the rest once it approves.",
      vehicles: cars,
      campaign: send.periodKey ?? "digest",
    };
  }
  return {
    kicker: "From Sabicars",
    headline: send.subject,
    intro: send.body ?? "",
    vehicles: cars,
    campaign: `broadcast-${send.id.slice(0, 8)}`,
  };
}

/** Sends a recorded newsletter to every active subscriber, 100 at a time. */
export async function deliver(sendId: string): Promise<{ recipients: number; failed: number; error?: string }> {
  const [send] = await db.select().from(newsletterSends).where(eq(newsletterSends.id, sendId)).limit(1);
  if (!send || send.status !== "sending") return { recipients: 0, failed: 0 };
  if (!emailConfigured()) {
    const error = "Email is not set up yet (RESEND_API_KEY and RESEND_FROM_EMAIL).";
    await db.update(newsletterSends).set({ status: "failed", error }).where(eq(newsletterSends.id, sendId));
    return { recipients: 0, failed: 0, error };
  }

  const content = await contentOf(send);
  // The weekly digest is about cars; a broadcast goes to everyone subscribed.
  const audience = await db
    .select({ email: subscribers.email, unsubscribeToken: subscribers.unsubscribeToken })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.dealerId, send.dealerId),
        eq(subscribers.isActive, true),
        send.kind === "digest" ? sql`${subscribers.topics} ? 'cars'` : undefined,
      ),
    );

  let recipients = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (let i = 0; i < audience.length; i += 100) {
    const chunk = audience.slice(i, i + 100);
    const r = await sendBatch(chunk.map((s) => messageFor(s, send.subject, content)));
    if (r.ok) recipients += chunk.length;
    else {
      failed += chunk.length;
      lastError = r.error;
    }
  }
  await db
    .update(newsletterSends)
    .set({ status: recipients ? "sent" : "failed", recipients, failed, error: lastError ?? null, sentAt: new Date() })
    .where(eq(newsletterSends.id, sendId));
  return { recipients, failed, error: lastError };
}

/** "digest:2026-W39" — the ISO week, in Lagos time, a digest belongs to. */
export function weekKey(at: Date): string {
  const lagos = new Date(at.getTime() + 60 * 60 * 1000);
  const d = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year.
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `digest:${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * The weekly digest. Idempotent: the week's key is unique, so a scheduler
 * that fires twice sends once. A week with no arrivals is recorded as
 * skipped, so the admin shows why nothing went out.
 */
export async function runWeeklyDigest(
  dealerId: string,
  now = new Date(),
): Promise<{ status: "sent" | "skipped" | "already" | "failed"; recipients?: number; error?: string }> {
  const periodKey = weekKey(now);
  const arrivals = await arrivalsSince(dealerId, new Date(now.getTime() - 7 * 86_400_000));
  const [send] = await db
    .insert(newsletterSends)
    .values({
      dealerId,
      kind: "digest",
      periodKey,
      subject:
        arrivals.length === 1 ? `New at Sabicars: the ${arrivals[0].title}` : `New at Sabicars this week: ${arrivals.length} arrivals`,
      vehicleIds: arrivals.map((a) => a.id),
      status: arrivals.length ? "sending" : "skipped",
      sentAt: arrivals.length ? null : now,
      error: arrivals.length ? null : "No new arrivals this week.",
    })
    .onConflictDoNothing()
    .returning({ id: newsletterSends.id });
  let sendId = send?.id;
  if (!sendId) {
    // This week's digest exists. If it reached nobody (email was not set up, or
    // the provider was down), try again rather than wait for next week.
    const [retry] = await db
      .update(newsletterSends)
      .set({ status: "sending", error: null, vehicleIds: arrivals.map((a) => a.id) })
      .where(
        and(
          eq(newsletterSends.dealerId, dealerId),
          eq(newsletterSends.periodKey, periodKey),
          eq(newsletterSends.status, "failed"),
          eq(newsletterSends.recipients, 0),
        ),
      )
      .returning({ id: newsletterSends.id });
    if (!retry || !arrivals.length) return { status: "already" };
    sendId = retry.id;
  }
  if (!arrivals.length) return { status: "skipped" };
  const r = await deliver(sendId);
  return r.recipients ? { status: "sent", recipients: r.recipients } : { status: "failed", error: r.error };
}

/** A staff broadcast: recorded, then sent. */
export async function createBroadcast(
  dealerId: string,
  staffId: string,
  subject: string,
  body: string,
  vehicleIds: string[],
): Promise<string> {
  const [send] = await db
    .insert(newsletterSends)
    .values({ dealerId, kind: "broadcast", subject, body, vehicleIds, createdBy: staffId })
    .returning({ id: newsletterSends.id });
  return send.id;
}

/** The welcome email, with a taste of what is in stock now. */
export async function sendWelcome(subscriberId: string): Promise<void> {
  if (!emailConfigured()) return;
  const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId)).limit(1);
  if (!sub?.isActive) return;
  const latest = await db
    .select(cardColumns)
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, sub.dealerId), eq(vehicles.status, "available")))
    .orderBy(desc(vehicles.publishedAt))
    .limit(3);
  const content: NewsletterContent = {
    kicker: "You are on the list",
    headline: `Welcome${sub.name ? `, ${sub.name.split(" ")[0]}` : ""}.`,
    intro:
      "Every Friday you will get the week's new arrivals — photographed, priced, and ready to inspect — and nothing you did not ask for.\n\nHere is what arrived most recently.",
    vehicles: await withCovers(latest),
    campaign: "welcome",
  };
  const m = messageFor(sub, "Welcome to Sabicars — new arrivals every Friday", content);
  const r = await sendEmail(m);
  if (!r.ok) console.error("[newsletter] welcome email failed", r.error);
}
