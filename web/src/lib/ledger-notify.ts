import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { commissions, partners, payouts, vehicles } from "@/db/schema";
import { alertManagers } from "@/lib/alerts";
import { emailConfigured, esc, sendEmail } from "@/lib/email";
import { maskAccount } from "@/lib/ledger-rules";
import { formatNaira } from "@/lib/money";
import { referralLink } from "@/lib/partners";
import { site, siteUrl } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * What the ledger tells people, after the fact. Each function is called by
 * the action or route that made the change, inside `after()`, so a slow or
 * failing email never delays or fails the change itself. Every one is safe
 * to call when email is not configured: it simply does nothing. None of them
 * throws: whatever goes wrong is logged, because the change itself already
 * stands.
 *
 * A partner's account number never leaves the database whole: every mention
 * is masked to its last four digits, in the email and in the logs.
 */

const lagosDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const partnerPageUrl = (accessToken: string) => `${siteUrl()}/partner/${accessToken}`;

/** A line of an email: plain text, or text with its own HTML where it carries a link. */
type Line = string | { text: string; html: string };

interface PartnerMail {
  to: string;
  subject: string;
  /** The spaced capitals above the logo line: what this email is. */
  eyebrow: string;
  firstName: string;
  /** The one figure or fact the email exists to say. */
  headline: string;
  lines: Line[];
  cta: { label: string; url: string };
  /** Small print under the button. */
  foot?: Line[];
}

const text = (l: Line) => (typeof l === "string" ? l : l.text);
const html = (l: Line) => (typeof l === "string" ? esc(l) : l.html);
/** A sentence with a link in it. In plain text the URL follows the sentence, unless the URL is the label. */
const linkIn = (before: string, url: string, label: string, after = "."): Line => ({
  text: label === url ? `${before}${url}${after}` : `${before}${label}${after} ${url}`,
  html: `${esc(before)}<a href="${esc(url)}" style="color:#A5DB6F">${esc(label)}</a>${esc(after)}`,
});

/** The same dark template as every Sabicars email (lib/viewing-reminders.ts), with the partner programme's own eyebrow. */
function partnerEmail(m: PartnerMail) {
  const foot = m.foot ?? [];
  const textBody = [
    `Hello ${m.firstName},`,
    ``,
    m.headline,
    ``,
    ...m.lines.map(text),
    ``,
    `${m.cta.label}: ${m.cta.url}`,
    ``,
    ...foot.map(text),
    ...(foot.length ? [``] : []),
    `${site.legalName} · CAC RC ${site.rcNumber}`,
  ].join("\n");
  const rows = m.lines.map((l) => `<tr><td style="padding:8px 0 0;font-size:16px;line-height:1.6;color:#CFD2CC">${html(l)}</td></tr>`).join("\n");
  const footRows = foot.map((l) => `<tr><td style="padding:12px 0 0;font-size:13px;line-height:1.6;color:#9FA59E">${html(l)}</td></tr>`).join("\n");
  const htmlBody = `<!doctype html><html><body style="margin:0;background:#090E0A;font-family:Helvetica,Arial,sans-serif;color:#F2F2EC">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090E0A"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 28px"><img src="${esc(siteUrl())}/brand/logo-email.png" width="220" height="45" alt="Sabicars" style="display:block;border:0"><div style="padding-top:14px;font-size:12px;letter-spacing:3px;color:#8DC74D">${esc(m.eyebrow.toUpperCase())}</div></td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#CFD2CC">Hello ${esc(m.firstName)},</td></tr>
<tr><td style="padding:12px 0 0;font-weight:bold;letter-spacing:-0.4px;font-size:26px;line-height:1.2;color:#F2F2EC">${esc(m.headline)}</td></tr>
${rows}
<tr><td style="padding:28px 0"><a href="${esc(m.cta.url)}" style="display:inline-block;background:#F7801E;color:#090E0A;padding:16px 28px;border-radius:999px;font-size:15px;font-weight:bold;text-decoration:none">${esc(m.cta.label)}</a></td></tr>
${footRows}
<tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:#9FA59E">${esc(site.legalName)} · CAC RC ${esc(site.rcNumber)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: m.to, subject: m.subject, html: htmlBody, text: textBody, replyTo: site.email };
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

async function send(what: string, m: PartnerMail): Promise<void> {
  const sent = await sendEmail(partnerEmail(m));
  if (!sent.ok) console.error(`[ledger-notify] ${what} not sent`, sent.error);
}

/** A commission with the partner it is owed to and the vehicle it came from. */
async function commissionWithContext(commissionId: string) {
  const [row] = await db
    .select({ c: commissions, p: partners, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(commissions)
    .innerJoin(partners, eq(partners.id, commissions.partnerId))
    .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
    .where(eq(commissions.id, commissionId))
    .limit(1);
  return row ? { ...row, title: vehicleTitle({ year: row.year, make: row.make, model: row.model }) } : null;
}

/** A payout with its commission, partner and vehicle. */
async function payoutWithContext(payoutId: string) {
  const [row] = await db
    .select({ o: payouts, c: commissions, p: partners, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(payouts)
    .innerJoin(commissions, eq(commissions.id, payouts.commissionId))
    .innerJoin(partners, eq(partners.id, payouts.partnerId))
    .innerJoin(vehicles, eq(vehicles.id, commissions.vehicleId))
    .where(eq(payouts.id, payoutId))
    .limit(1);
  return row ? { ...row, title: vehicleTitle({ year: row.year, make: row.make, model: row.model }) } : null;
}

/** A new partner: their code, their referral link and their private page link, by email when they gave one. */
export async function notifyPartnerWelcome(partnerId: string): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const [p] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!p?.email) return;
    const share = referralLink(siteUrl(), p.code);
    const page = partnerPageUrl(p.accessToken);
    await send("partner welcome", {
      to: p.email,
      subject: `Welcome to Sabicars Refer & Earn — your code is ${p.code}`,
      eyebrow: "Refer & Earn",
      firstName: firstNameOf(p.name),
      headline: `Your code is ${p.code}`,
      lines: [
        linkIn("Share your link with anyone looking for a car: ", share, share, ""),
        "You earn 1.5% of what a car sells for when a buyer you sent completes a purchase, paid after a cooling-off of a day or two into a bank account in your own name.",
        "Joining is free, and you never earn from signing up other partners: only from buyers you bring.",
        linkIn("Your partner page shows every enquiry and commission, and is where you register the account you are paid into. It is private to you, so keep the link to yourself: ", page, page, ""),
      ],
      cta: { label: "Open your partner page", url: page },
      foot: ["Anyone asking you to pay to join, or to pay for a better code, is not Sabicars."],
    });
  } catch (e) {
    console.error("[ledger-notify] welcome failed", e);
  }
}

/** The partner: "a sale you brought in is on record; it is paid after the cooling-off". */
export async function notifyCommissionRecorded(commissionId: string): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const row = await commissionWithContext(commissionId);
    if (!row || !row.p.email || row.c.status !== "pending") return;
    const { c, p, title } = row;
    const to = row.p.email;
    const page = partnerPageUrl(p.accessToken);
    const rate = `${c.rateBps / 100}%`;
    await send("commission recorded", {
      to,
      subject: `A sale you brought in is on record: ${title}`,
      eyebrow: "Your commission",
      firstName: firstNameOf(p.name),
      headline: `${formatNaira(c.amountMinor)} is yours`,
      lines: [
        `The ${title} sold for ${formatNaira(c.salePriceMinor)} to a buyer you sent. Your commission is ${rate} of that: ${formatNaira(c.amountMinor)}.`,
        `It is paid after ${lagosDate(c.payableAt)}, once the sale stands, into the bank account registered on your page.`,
        p.accountNumber
          ? p.accountVerifiedAt
            ? `Your ${p.bankName ?? "bank"} account ${maskAccount(p.accountNumber)} is verified, so nothing more is needed from you.`
            : `Your ${p.bankName ?? "bank"} account ${maskAccount(p.accountNumber)} is registered. Sabicars confirms it is in your name before the first payout.`
          : "You have not registered a bank account yet. Add one on your page, in your own name, so the payout can go through.",
      ],
      cta: { label: "See it on your partner page", url: page },
    });
  } catch (e) {
    console.error("[ledger-notify] commission recorded failed", e);
  }
}

/** The partner: "your commission has been paid", with the amount, the account and the reference. */
export async function notifyCommissionPaid(payoutId: string): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const row = await payoutWithContext(payoutId);
    if (!row || !row.p.email || row.o.status !== "paid") return;
    const { o, p, title } = row;
    const to = row.p.email;
    const page = partnerPageUrl(p.accessToken);
    const account = o.accountNumber ? `${o.bankName ?? "bank"} account ${maskAccount(o.accountNumber)}` : (o.bankName ?? "bank account");
    const reference = o.method === "bank_transfer" && o.bankReference ? `Bank reference ${o.bankReference}` : `Reference ${o.reference}`;
    await send("commission paid", {
      to,
      subject: `Your Sabicars commission has been paid: ${formatNaira(o.amountMinor)}`,
      eyebrow: "Commission paid",
      firstName: firstNameOf(p.name),
      headline: `${formatNaira(o.amountMinor)} paid to you`,
      lines: [
        `Your commission on the ${title} was paid on ${lagosDate(o.paidAt ?? o.updatedAt)} to your ${account}.`,
        `${reference}. Keep it in case your bank needs to trace the payment; a transfer usually shows within minutes, sometimes by the next working day.`,
      ],
      cta: { label: "See it on your partner page", url: page },
      foot: [`If it has not arrived after a working day, reply to this email or call ${site.phones[0].display} with the reference.`],
    });
  } catch (e) {
    console.error("[ledger-notify] commission paid failed", e);
  }
}

/** The partner: their bank account was saved, and whether it is verified or waiting for Sabicars to confirm. */
export async function notifyAccountSaved(partnerId: string): Promise<void> {
  try {
    const [p] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!p?.accountNumber || !p.bankName) return;
    const masked = maskAccount(p.accountNumber);
    // Managers always hear of a change to where money goes, verified or not: a hijacked link shows up here first.
    await alertManagers(p.dealerId, {
      title: p.accountVerifiedAt ? "A partner registered a verified bank account" : "A partner's bank account needs confirming",
      body: `${p.name} (${p.code}) · ${p.bankName} ${masked} · name the bank returned: ${p.accountName ?? "none"}${p.accountVerifiedAt ? "" : " · confirm it only if it is in the partner's own name"}`,
      url: `/admin/partners/${p.id}`,
      tag: `partner-bank-${p.id}`,
      action: "Open the partner",
    });
    if (!emailConfigured() || !p.email) return;
    const page = partnerPageUrl(p.accessToken);
    await send("account saved", {
      to: p.email,
      subject: p.accountVerifiedAt ? "Your bank account is registered and verified" : "Your bank account is registered",
      eyebrow: "Your bank account",
      firstName: firstNameOf(p.name),
      headline: `${p.bankName} · ${masked}`,
      lines: [
        p.accountVerifiedAt
          ? "The name the bank holds for this account matches yours, so it is verified. Your commissions are paid into it and nowhere else."
          : "Sabicars will confirm it is in your name before your first payout. Commissions are paid only into an account in the partner's own name, so nobody else can collect what you earned.",
        "To change it, open your partner page and enter the new account; a change starts the check again.",
      ],
      cta: { label: "Open your partner page", url: page },
      foot: [`If you did not make this change, reply to this email or call ${site.phones[0].display} at once.`],
    });
  } catch (e) {
    console.error("[ledger-notify] account saved failed", e);
  }
}

/** Managers: a Paystack transfer failed or was returned, with the reason, so somebody acts on it. */
export async function notifyPayoutFailed(payoutId: string): Promise<void> {
  try {
    const row = await payoutWithContext(payoutId);
    if (!row) return;
    const { o, p, title } = row;
    const returned = o.status === "reversed";
    const account = o.accountNumber ? ` to ${o.bankName ?? "bank"} ${maskAccount(o.accountNumber)}` : "";
    await alertManagers(o.dealerId, {
      title: returned ? `A partner payout was returned: ${formatNaira(o.amountMinor)}` : `A partner payout failed: ${formatNaira(o.amountMinor)}`,
      body: `${p.name} (${p.code}) · ${title} · ${formatNaira(o.amountMinor)}${account}. ${o.failureReason ?? "Paystack gave no reason."} The commission is still owed: fix the cause, then pay it again from the payouts page.`,
      url: "/admin/payouts",
      tag: `payout-${o.id}`,
      action: "Open payouts",
    });
  } catch (e) {
    console.error("[ledger-notify] payout failed alert failed", e);
  }
}

/** Managers: a commission that was already paid belongs to a sale that has just been unwound. */
export async function notifyPaidCommissionUnwound(commissionId: string): Promise<void> {
  try {
    const row = await commissionWithContext(commissionId);
    if (!row) return;
    const { c, p, title } = row;
    await alertManagers(c.dealerId, {
      title: `A paid commission's sale was unwound: ${title}`,
      body: `The ${title} is no longer recorded as sold, but ${p.name} (${p.code}) was already paid ${formatNaira(c.amountMinor)}${c.paidAt ? ` on ${lagosDate(c.paidAt)}` : ""}. The platform does not take money back: decide with the partner how it is recovered, and note it on their page.`,
      url: `/admin/partners/${p.id}`,
      tag: `commission-${c.id}`,
      action: "Open the partner",
    });
  } catch (e) {
    console.error("[ledger-notify] paid commission unwound alert failed", e);
  }
}
