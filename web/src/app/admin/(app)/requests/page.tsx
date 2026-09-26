import type { Metadata } from "next";
import Link from "next/link";
import { NotifyOnWhatsApp, RequestControls } from "@/components/admin/RequestControls";
import { requireStaff } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { demandSummary, pendingPriceDrops, REQUEST_VIEWS, requestBoard, requestCounts, type BoardMatch, type RequestView } from "@/lib/repositories/requests";
import { siteUrl } from "@/lib/site";
import { PAYMENT_OPTIONS } from "@/lib/sourcing";
import { matchWhatsAppText } from "@/lib/sourcing-engine";
import { priceDropWhatsAppText } from "@/lib/watch-engine";

export const metadata: Metadata = { title: "Sourcing Desk · Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ view?: string }> };

function ago(d: Date): string {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 30 ? `${days}d ago` : new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const CHANNEL_LABEL: Record<string, string> = { email: "Emailed", on_screen: "Shown when they asked", staff: "Sent by staff", whatsapp: "WhatsApp sent", sms: "SMS sent" };

function matchState(m: BoardMatch): { label: string; tone: string } {
  if (m.status === "sent") return { label: `${CHANNEL_LABEL[m.channel ?? ""] ?? "Sent"}${m.sentAt ? ` · ${ago(m.sentAt)}` : ""}`, tone: "text-success" };
  if (m.status === "failed") return { label: "Email failed — send it yourself", tone: "text-danger" };
  if (m.status === "dismissed") return { label: "Dismissed", tone: "text-text-muted" };
  return { label: "Not sent yet", tone: "text-accent-text" };
}

/**
 * The Sourcing Desk, staff side.
 *
 * Its one job: make sure no buyer who asked for a car is forgotten. Staff
 * judge which requests are serious enough to source for; the engine offers
 * every newly listed car to the buyers waiting for it, and anything it could
 * not deliver waits here with the message already written.
 */
export default async function SourcingDeskAdmin({ searchParams }: Props) {
  const me = await requireStaff();
  const sp = await searchParams;
  const view: RequestView = sp.view && sp.view in REQUEST_VIEWS ? (sp.view as RequestView) : "review";
  const [rows, counts, demand, drops] = await Promise.all([requestBoard(me.dealerId, view), requestCounts(me.dealerId), demandSummary(me.dealerId), pendingPriceDrops(me.dealerId)]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Sourcing Desk</p>
          <h1 className="mt-2 text-display-3">Buyer requests</h1>
        </div>
        {counts.toNotify > 0 && (
          <p className="border border-gold-700 px-4 py-2 text-sm text-text-primary">
            <span className="figures font-semibold text-accent-text">{counts.toNotify}</span> {counts.toNotify === 1 ? "buyer is" : "buyers are"} waiting to hear from you
          </p>
        )}
      </div>

      {drops.length > 0 && (
        <section aria-label="Price drops to tell buyers" className="mt-8 border border-gold-700 bg-surface-1 p-5 md:p-6">
          <p className="text-sm font-semibold text-text-primary">Price drops to tell buyers</p>
          <p className="mt-1 text-xs text-text-muted">These buyers are watching a car whose price you cut, and could not be reached automatically.</p>
          <ul className="mt-4 grid gap-3">
            {drops.map((d) => {
              const url = `${siteUrl()}/vehicles/${d.vehicle.slug}`;
              const waNumber = d.buyer.phone?.replace("+", "");
              return (
                <li key={d.watchId} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-text-primary">
                      {d.buyer.name}
                      {d.buyer.phone && <span className="figures ml-2 text-text-muted">{displayPhone(d.buyer.phone)}</span>}
                      <span className="figures ml-2 text-xs text-text-muted">{d.reference}</span>
                    </p>
                    <p className="text-text-secondary">
                      <Link href={`/vehicles/${d.vehicle.slug}`} target="_blank" className="hover:text-accent-text">
                        {d.vehicle.title}
                      </Link>
                      <span className="figures ml-2 text-xs">
                        {d.wasMinor ? <span className="line-through">{formatNaira(d.wasMinor)}</span> : "price on request"} → {formatNaira(d.nowMinor)}
                      </span>
                    </p>
                    {d.status === "failed" && <p className="text-xs text-danger">Email failed — send it yourself</p>}
                  </div>
                  {waNumber && (
                    <NotifyOnWhatsApp
                      watchId={d.watchId}
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(priceDropWhatsAppText({ firstName: d.buyer.name.split(" ")[0], title: d.vehicle.title, was: d.wasMinor, now: d.nowMinor, url }))}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {demand.length > 0 && (
        <section aria-label="What buyers want" className="mt-8 border border-border-subtle bg-surface-1 p-5 md:p-6">
          <p className="eyebrow !text-text-muted">What buyers are waiting for — the sourcing list</p>
          <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {demand.map((d) => (
              <li key={d.want} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-2">
                <span className="truncate text-text-primary">{d.want}</span>
                <span className="figures shrink-0 text-xs text-text-muted">
                  ×{d.requests}
                  {d.topBudgetMinor ? ` · up to ${formatNaira(d.topBudgetMinor, { compact: true })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Request status" className="mt-8 flex gap-6 overflow-x-auto border-b border-border-subtle [scrollbar-width:none]">
        {(Object.keys(REQUEST_VIEWS) as RequestView[]).map((v) => (
          <Link
            key={v}
            href={v === "review" ? "/admin/requests" : `/admin/requests?view=${v}`}
            aria-current={view === v ? "true" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors ${
              view === v ? "border-gold-500 text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {REQUEST_VIEWS[v].label} <span className="figures text-xs text-text-muted">{counts[v]}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-text-muted">
          {view === "review" ? "No new requests. Every buyer who asks for a car appears here first." : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {rows.map((r) => {
            const firstName = r.buyer.name.split(" ")[0];
            const waNumber = r.buyer.phone?.replace("+", "");
            return (
              <li key={r.id} className="grid gap-6 border border-border-subtle bg-surface-1 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-display text-[1.6rem] leading-tight">{r.want}</h2>
                    <span className="figures text-xs text-text-muted">
                      {r.reference} · {ago(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {[
                      r.yearFrom && `${r.yearFrom} or newer`,
                      r.budgetMaxMinor ? `up to ${formatNaira(r.budgetMaxMinor)}` : "budget not stated",
                      PAYMENT_OPTIONS.find((p) => p.value === r.payment)?.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <span className="text-text-primary">{r.buyer.name}</span>
                    {r.buyer.phone && (
                      <a href={`tel:${r.buyer.phone}`} className="figures text-text-secondary hover:text-text-primary">
                        {displayPhone(r.buyer.phone)}
                      </a>
                    )}
                    {r.buyer.email && (
                      <a href={`mailto:${r.buyer.email}`} className="text-text-secondary hover:text-text-primary">
                        {r.buyer.email}
                      </a>
                    )}
                    {r.buyer.preferredContact && <span className="text-xs text-text-muted">prefers {r.buyer.preferredContact}</span>}
                  </div>
                  {(r.referredBy || r.buyerIsPartner) && (
                    <p className="mt-3 flex flex-wrap gap-2 text-xs">
                      {r.referredBy && <span className="border border-gold-700 px-2 py-1 text-accent-text">Referred by partner {r.referredBy} — 1.5% if it sells</span>}
                      {r.buyerIsPartner && <span className="border border-info px-2 py-1 text-info">Buyer is partner {r.buyerIsPartner} — partner price (1.5% off), no commission</span>}
                    </p>
                  )}

                  {r.matches.length > 0 && (
                    <div className="mt-5 border-t border-border-subtle pt-4">
                      <p className="text-xs text-text-muted">Offered</p>
                      <ul className="mt-2 grid gap-3">
                        {r.matches.map((m) => {
                          const s = matchState(m);
                          const url = `${siteUrl()}/vehicles/${m.vehicle.slug}`;
                          const price = m.vehicle.priceMinor ? formatNaira(m.vehicle.priceMinor) : "price on request";
                          return (
                            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <Link href={`/vehicles/${m.vehicle.slug}`} target="_blank" className="text-sm text-text-primary hover:text-accent-text">
                                  {m.vehicle.title}
                                </Link>
                                <span className="figures ml-2 text-xs text-text-muted">{price}</span>
                                <p className={`text-xs ${s.tone}`}>{s.label}</p>
                              </div>
                              {(m.status === "pending" || m.status === "failed") && waNumber && m.vehicle.status === "available" && (
                                <NotifyOnWhatsApp
                                  matchId={m.id}
                                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(matchWhatsAppText({ firstName, title: m.vehicle.title, price, reference: r.reference, url }))}`}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <RequestControls key={`${r.id}-${r.status}-${r.staffNote ?? ""}`} requestId={r.id} status={r.status} staffNote={r.staffNote} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
