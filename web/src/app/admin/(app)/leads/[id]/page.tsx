import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons, NoteForm, OwnerControl, ReviewRequest, StatusControl } from "@/components/admin/LeadActions";
import { Stars } from "@/components/reviews/Stars";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, RESPONSE_TARGET_MINUTES } from "@/lib/lead-labels";
import { formatNaira } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { assignableStaff, leadDetail, type LeadDetail } from "@/lib/repositories/leads";
import { formatWait } from "@/lib/showroom-hours";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Enquiry · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

const when = (d: Date) =>
  new Date(d).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  });

const CHANNEL_LABEL: Record<string, string> = {
  web_form: "the website",
  assistant: "Ask Sabicars",
  phone: "a phone call",
  walk_in: "a walk-in",
  whatsapp: "WhatsApp",
  legacy_import: "the old website",
};

const PREFERS: Record<string, string> = { phone: "a call", whatsapp: "WhatsApp", email: "email" };

/** What the buyer asked for, in the words a salesperson would open with. */
function subject(d: LeadDetail): string {
  const car = d.vehicle?.title;
  switch (d.lead.type) {
    case "drive_plan":
      return car ? `your Drive Plan request for the ${car}` : "your Drive Plan request";
    case "fleet":
      return "your fleet quotation request";
    case "sourcing":
      return d.request ? `your request for a ${d.request.want}` : "your request";
    case "watch":
      return car ? `the ${car} you are watching` : "the car you are watching";
    case "contact":
      return "your message";
    default:
      return car ? `your enquiry about the ${car}` : "your enquiry";
  }
}

/**
 * One enquiry: who, what they want, and every step taken since. Built to be
 * used one-handed on a phone, straight from the alert.
 */
export default async function LeadPage({ params }: Props) {
  const me = await requireStaff();
  const { id } = await params;
  const [d, people] = await Promise.all([leadDetail(me.dealerId, id), assignableStaff(me.dealerId)]);
  if (!d) notFound();
  const { lead } = d;
  const [chat] =
    lead.channel === "assistant"
      ? await db.select({ id: assistantConversations.id }).from(assistantConversations).where(eq(assistantConversations.leadId, lead.id)).limit(1)
      : [];

  const buyerFirst = lead.name.trim().split(/\s+/)[0];
  const myFirst = (me.fullName ?? me.email).split(/[\s@]/)[0];
  const whatsappText = `Hello ${buyerFirst}, this is ${myFirst} from Sabicars, about ${subject(d)} (${d.reference}).`;
  const legacy = lead.channel === "legacy_import";
  const late = d.responseMinutes !== null && d.responseMinutes >= RESPONSE_TARGET_MINUTES;

  const reviewLink = lead.reviewToken ? `${siteUrl()}/review/${lead.reviewToken}` : null;
  const reviewAsk = `Hello ${buyerFirst}, thank you for buying ${d.vehicle ? `the ${d.vehicle.title}` : "your vehicle"} from Sabicars. Would you tell others how it went? It takes a minute: ${reviewLink}`;

  const attribution = [
    lead.landingPath && `Sent from ${lead.landingPath}`,
    lead.utmSource && `Campaign: ${[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ")}`,
  ].filter(Boolean);

  return (
    <>
      <LiveRefresh />
      <Link href="/admin/leads" className="text-sm text-text-muted hover:text-text-primary">
        ← Inbox
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-6">
        <div className="min-w-0">
          <p className="eyebrow">
            {LEAD_TYPE_LABEL[lead.type]} · <span className="figures">{d.reference}</span>
          </p>
          <h1 className="mt-2 text-display-3 break-words">{lead.name}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {when(lead.createdAt)} · from {CHANNEL_LABEL[lead.channel] ?? lead.channel}
            {chat && (
              <>
                {" "}
                ·{" "}
                <Link href={`/admin/conversations/${chat.id}`} className="text-gold-300 hover:text-gold-200">
                  Read the chat →
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-text-primary">
            {legacy && lead.status === "new" ? "From the old site" : LEAD_STATUS_LABEL[lead.status]}
          </p>
          {d.responseMinutes !== null && (
            <p
              className={`figures mt-1 text-sm ${lead.firstResponseAt ? (late ? "text-accent-text" : "text-success") : late ? "text-danger" : "text-accent-text"}`}
            >
              {lead.firstResponseAt
                ? `First reply in ${formatWait(d.responseMinutes)}`
                : d.responseMinutes === 0
                  ? `Clock starts ${when(d.clockStartedAt)}`
                  : `Waiting ${formatWait(d.responseMinutes)}`}
            </p>
          )}
          {lead.escalatedAt && <p className="mt-1 text-xs text-danger">Managers alerted {when(lead.escalatedAt)}</p>}
        </div>
      </header>

      {/* On a phone: reach them, then who has it and where it stands, then the detail. On a desk: the last two as a sidebar. */}
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Reach the buyer" className="min-w-0 lg:col-start-1">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
            {lead.phone && <span className="figures text-lg text-text-primary">{displayPhone(lead.phone)}</span>}
            {lead.email && <span className="break-all text-text-secondary">{lead.email}</span>}
            {lead.preferredContact && (
              <span className="text-xs text-text-muted">prefers {PREFERS[lead.preferredContact] ?? lead.preferredContact}</span>
            )}
          </div>
          <div className="mt-4">
            <ContactButtons
              leadId={lead.id}
              phone={lead.phone}
              email={lead.email}
              preferred={lead.preferredContact}
              whatsappText={whatsappText}
              emailSubject={`Your Sabicars enquiry ${d.reference}`}
            />
          </div>
        </section>

        <aside
          className={`grid content-start gap-8 lg:col-start-2 lg:row-start-1 ${lead.status === "won" && reviewLink ? "lg:row-span-4" : "lg:row-span-3"}`}
        >
          <section aria-label="Who is handling it" className="border border-border-subtle bg-surface-1 p-5">
            <OwnerControl
              key={lead.assignedTo ?? "none"}
              leadId={lead.id}
              assigneeId={lead.assignedTo}
              assigneeName={d.assignee?.name ?? null}
              people={people}
              canAssign={me.role !== "sales"}
            />
          </section>
          <section aria-label="Status" className="border border-border-subtle bg-surface-1 p-5">
            <StatusControl
              key={`${lead.status}-${lead.lostReason ?? ""}`}
              leadId={lead.id}
              status={lead.status}
              lostReason={lead.lostReason}
            />
          </section>
          {d.history.length > 0 && (
            <section aria-label="Their other enquiries">
              <p className="eyebrow !text-text-muted">Their other enquiries</p>
              <ul className="mt-3 divide-y divide-border-subtle">
                {d.history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/admin/leads/${h.id}`}
                      className="flex items-baseline justify-between gap-3 py-2.5 text-sm hover:text-accent-text"
                    >
                      <span className="text-text-primary">{LEAD_TYPE_LABEL[h.type]}</span>
                      <span className="figures text-xs text-text-muted">
                        {LEAD_STATUS_LABEL[h.status]} ·{" "}
                        {new Date(h.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        {lead.status === "won" && reviewLink && (
          <section aria-label="Their review" className="min-w-0 border border-gold-700 bg-surface-1 p-5 md:p-6 lg:col-start-1">
            <p className="eyebrow !text-text-muted">Their review</p>
            {d.review ? (
              <p className="mt-3 text-sm text-text-secondary">
                <Stars rating={d.review.rating} className="mr-2 align-[-2px]" />
                {d.review.isApproved
                  ? "Published on the site as a verified buyer."
                  : d.review.reviewedAt
                    ? "Hidden."
                    : "Waiting to be read."}{" "}
                <Link href="/admin/reviews" className="font-semibold text-accent-text hover:text-text-primary">
                  Reviews
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-text-secondary">
                  A sale earns the buyer a private link. A review left through it shows as{" "}
                  <span className="text-text-primary">Verified buyer</span> — the strongest proof the site can show.
                </p>
                <div className="mt-4">
                  <ReviewRequest leadId={lead.id} phone={lead.phone} whatsappText={reviewAsk} link={reviewLink} />
                </div>
              </>
            )}
          </section>
        )}

        <section aria-label="What they asked" className="min-w-0 border border-border-subtle bg-surface-1 p-5 md:p-6 lg:col-start-1">
          <p className="eyebrow !text-text-muted">What they asked</p>
          {d.vehicle && (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <Link
                href={`/vehicles/${d.vehicle.slug}`}
                target="_blank"
                className="font-display text-[1.5rem] leading-tight text-text-primary hover:text-accent-text"
              >
                {d.vehicle.title}
              </Link>
              <span className="figures text-sm text-text-muted">
                {d.vehicle.priceMinor ? formatNaira(d.vehicle.priceMinor) : "price on request"}
                {d.vehicle.status !== "available" && ` · ${d.vehicle.status}`}
              </span>
            </p>
          )}
          {d.request && (
            <p className="mt-3 text-sm text-text-secondary">
              Wants a <span className="text-text-primary">{d.request.want}</span> —{" "}
              <Link href="/admin/requests" className="font-semibold text-accent-text hover:text-text-primary">
                on the Sourcing Desk
              </Link>
            </p>
          )}
          {d.watching.length > 0 && (
            <p className="mt-3 text-sm text-text-secondary">
              Watching for a price cut:{" "}
              {d.watching.map((w, i) => (
                <span key={w.slug}>
                  {i > 0 && ", "}
                  <Link href={`/vehicles/${w.slug}`} target="_blank" className="text-text-primary hover:text-accent-text">
                    {w.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {lead.message ? (
            <p className="mt-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-text-primary">{lead.message}</p>
          ) : (
            !d.vehicle && !d.request && <p className="mt-3 text-sm text-text-muted">No message.</p>
          )}
          {(d.referredBy || d.buyerIsPartner || attribution.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border-subtle pt-4 text-xs">
              {d.referredBy && (
                <span className="border border-gold-700 px-2 py-1 text-accent-text">
                  Referred by partner {d.referredBy.name} ({d.referredBy.code}) — 1.5% if it sells
                </span>
              )}
              {d.buyerIsPartner && (
                <span className="border border-info px-2 py-1 text-info">
                  Buyer is partner {d.buyerIsPartner.code} — partner price (1.5% off), no commission
                </span>
              )}
              {attribution.map((a) => (
                <span key={a} className="px-2 py-1 text-text-muted">
                  {a}
                </span>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Notes and activity" className="min-w-0 lg:col-start-1">
          <p className="eyebrow !text-text-muted">Notes and activity</p>
          <div className="mt-4">
            <NoteForm leadId={lead.id} />
          </div>
          <ol className="mt-6 grid gap-4 border-l border-border-subtle pl-5">
            {d.activity.map((a) => (
              <li key={a.id} className="relative">
                <span
                  aria-hidden
                  className={`absolute top-1.5 -left-[1.4rem] size-2 rounded-full ${a.kind === "escalated" ? "bg-danger" : a.kind === "note" ? "bg-gold-500" : "bg-border-strong"}`}
                />
                <p className={`text-sm ${a.kind === "note" ? "whitespace-pre-wrap text-text-primary" : "text-text-secondary"}`}>
                  {a.detail}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {a.by ?? "Sabicars"} · {when(a.createdAt)}
                </p>
              </li>
            ))}
            <li className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-border-strong" />
              <p className="text-sm text-text-secondary">Enquiry received from {CHANNEL_LABEL[lead.channel] ?? lead.channel}</p>
              <p className="mt-0.5 text-xs text-text-muted">{when(lead.createdAt)}</p>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
