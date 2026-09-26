import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { after } from "next/server";
import { Search } from "lucide-react";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { PhoneAlerts } from "@/components/admin/PhoneAlerts";
import { escalateStaleLeads } from "@/lib/alerts";
import { requireStaff } from "@/lib/auth";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, RESPONSE_TARGET_MINUTES } from "@/lib/lead-labels";
import { displayPhone } from "@/lib/phone";
import { inbox, inboxCounts, LEAD_VIEWS, myAlertSettings, responseStats, type InboxLead, type LeadView } from "@/lib/repositories/leads";
import { formatWait } from "@/lib/showroom-hours";

export const metadata: Metadata = { title: "Enquiries · Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

function ago(d: Date): string {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 30 ? `${days}d ago` : new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

/** How long it has been waiting, coloured by how close it is to the target. */
function Waiting({ lead }: { lead: InboxLead }) {
  const m = lead.waitingMinutes!;
  // Exactly zero: it came in after hours and its clock starts when the showroom opens.
  if (m === 0) return <span className="text-xs text-text-muted">Arrived after hours</span>;
  const tone = lead.escalatedAt || m >= RESPONSE_TARGET_MINUTES ? "text-danger" : m >= 5 ? "text-accent-text" : "text-success";
  return <span className={`figures text-xs font-semibold ${tone}`}>Waiting {formatWait(m)}</span>;
}

/**
 * The inbox: every enquiry from every form, and who is answering it.
 *
 * Its one job: no buyer waits. New enquiries alert every phone that has
 * alerts on; an enquiry nobody answers in fifteen showroom minutes alerts the
 * managers; and how fast Sabicars answers is measured, not guessed.
 */
export default async function LeadsInbox({ searchParams }: Props) {
  const me = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const view: LeadView = sp.view && sp.view in LEAD_VIEWS ? (sp.view as LeadView) : "waiting";
  const [rows, counts, stats, alerts] = await Promise.all([
    inbox(me.dealerId, me.id, view, q),
    inboxCounts(me.dealerId, me.id),
    responseStats(me.dealerId),
    myAlertSettings(me.id),
  ]);
  // Someone is looking: a good moment to check nothing has been left too long.
  after(() => escalateStaleLeads().catch((e) => console.error("[leads] escalation sweep failed", e)));

  const oldest = rows.length && view === "waiting" && !q ? rows[0].waitingMinutes : null;
  const figures = [
    {
      label: "Waiting for a reply",
      value: String(counts.waiting),
      note: oldest ? `longest ${formatWait(oldest)}` : "none waiting",
      alert: counts.waiting > 0,
    },
    {
      label: "Typical first reply",
      value: stats.medianMinutes === null ? "—" : formatWait(stats.medianMinutes),
      note: `middle of ${stats.answered} in ${stats.days} days`,
    },
    {
      label: `Answered within ${RESPONSE_TARGET_MINUTES} min`,
      value: stats.withinTarget === null ? "—" : `${Math.round(stats.withinTarget * 100)}%`,
      note: `${stats.received} ${stats.received === 1 ? "enquiry" : "enquiries"} in ${stats.days} days`,
    },
    { label: "Escalated to managers", value: String(stats.escalated), note: `in ${stats.days} days` },
  ];

  return (
    <>
      <LiveRefresh />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Enquiries</p>
          <h1 className="mt-2 text-display-3">Inbox</h1>
        </div>
        <Form action="/admin/leads" className="relative w-full sm:w-80">
          <Search aria-hidden size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <label htmlFor="lead-search" className="sr-only">
            Search enquiries
          </label>
          <input
            id="lead-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, phone or SC- reference"
            className="min-h-11 w-full border border-border-default bg-surface-1 pr-3 pl-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold-500"
          />
        </Form>
      </div>

      <div className="mt-8">
        <PhoneAlerts
          publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          receivesAlerts={alerts.receivesAlerts}
          waiting={counts.waiting}
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="bg-surface-1 p-4 md:p-5">
            <dt className="text-xs text-text-muted">{f.label}</dt>
            <dd className={`figures mt-1 text-2xl font-semibold ${f.alert ? "text-accent-text" : "text-text-primary"}`}>{f.value}</dd>
            <dd className="mt-0.5 text-xs text-text-muted">{f.note}</dd>
          </div>
        ))}
      </dl>

      {q ? (
        <p className="mt-8 flex flex-wrap items-center gap-3 border-b border-border-subtle pb-3 text-sm text-text-secondary">
          {rows.length} {rows.length === 1 ? "enquiry matches" : "enquiries match"} “{q}”
          <Link href="/admin/leads" className="font-semibold text-accent-text hover:text-text-primary">
            Clear search
          </Link>
        </p>
      ) : (
        <nav aria-label="Enquiry views" className="mt-8 flex gap-6 overflow-x-auto border-b border-border-subtle [scrollbar-width:none]">
          {(Object.keys(LEAD_VIEWS) as LeadView[]).map((v) => (
            <Link
              key={v}
              href={v === "waiting" ? "/admin/leads" : `/admin/leads?view=${v}`}
              aria-current={view === v ? "true" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors ${
                view === v ? "border-gold-500 text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {LEAD_VIEWS[v]}{" "}
              <span className={`figures text-xs ${v === "waiting" && counts.waiting ? "text-accent-text" : "text-text-muted"}`}>
                {counts[v]}
              </span>
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <p className="py-16 text-center text-text-muted">
          {q
            ? "Nothing matches. Try the last digits of the phone number, or the reference the buyer quoted."
            : view === "waiting"
              ? "Nobody is waiting. Every enquiry from the site lands here first."
              : view === "mine"
                ? "Nothing is with you. Take one from Waiting."
                : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {rows.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/leads/${l.id}`}
                className="group grid gap-x-6 gap-y-1 py-4 transition-colors hover:bg-surface-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold text-text-primary group-hover:text-accent-text">{l.name}</span>
                    <span className="text-xs text-text-secondary">{LEAD_TYPE_LABEL[l.type]}</span>
                    <span className="figures text-xs text-text-muted">{l.reference}</span>
                  </p>
                  {l.about && <p className="mt-1 truncate text-sm text-text-secondary">{l.about}</p>}
                  <p className="figures mt-1 text-xs text-text-muted">{l.phone ? displayPhone(l.phone) : l.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                  {l.waitingMinutes !== null ? (
                    <Waiting lead={l} />
                  ) : (
                    <span className="text-xs text-text-secondary">
                      {l.channel === "legacy_import" ? "From the old site" : LEAD_STATUS_LABEL[l.status]}
                    </span>
                  )}
                  <span className="text-xs text-text-muted">
                    {l.assignee ?? "Unclaimed"} · {ago(l.createdAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {me.role !== "sales" && stats.people.length > 0 && (
        <section aria-label="Response by person" className="mt-12 border border-border-subtle bg-surface-1 p-5 md:p-6">
          <p className="eyebrow !text-text-muted">First reply by person — last {stats.days} days</p>
          <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.people.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-2">
                <span className="truncate text-text-primary">{p.name}</span>
                <span className="figures shrink-0 text-xs text-text-muted">
                  {p.answered} answered · typically {formatWait(p.medianMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
