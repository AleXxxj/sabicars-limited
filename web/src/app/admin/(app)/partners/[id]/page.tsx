import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmAccount, CopyLink, PartnerStatusControl, VoidCommission } from "@/components/admin/PartnerAdminActions";
import { can, requireStaff } from "@/lib/auth";
import { partnerAccessToken, partnerStatement, type CommissionRow } from "@/lib/ledger";
import { COMMISSION_STATUS_LABEL, PAYOUT_STATUS_LABEL } from "@/lib/ledger-rules";
import { formatNaira } from "@/lib/money";
import { referralLink } from "@/lib/partners";
import { displayPhone } from "@/lib/phone";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Partner · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

const onDate = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const atTime = (d: Date) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

const METHOD_LABEL: Record<string, string> = { paystack: "Paystack transfer", bank_transfer: "Bank transfer" };
const SOURCE_LABEL: Record<string, string> = { link: "their link", manual: "attributed by a manager" };

/** Where a commission stands, in the words the partner's own page uses. */
function commissionState(c: CommissionRow): { text: string; tone: string } {
  if (c.status === "paid") return { text: `Paid on ${c.paidAt ? onDate(c.paidAt) : "record"}`, tone: "text-success" };
  if (c.status === "void") return { text: `Void: ${c.voidReason ?? "no reason recorded"}`, tone: "text-text-muted" };
  if (c.payable) return { text: "Ready to pay", tone: "text-accent-text" };
  return { text: `In cooling-off until ${atTime(c.payableAt)}`, tone: "text-text-secondary" };
}

/**
 * One partner: who they are, how to reach them, the bank account they are
 * paid into, every commission they have earned and every payment made. The
 * same statement the partner sees on their private page, with the controls
 * only a manager has.
 */
export default async function PartnerPage({ params }: Props) {
  const me = await requireStaff();
  if (!can.payPartners(me)) redirect("/admin/vehicles");
  const { id } = await params;
  // A malformed id is simply "not found", not a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s, token] = await Promise.all([partnerStatement(me.dealerId, id), partnerAccessToken(me.dealerId, id)]);
  if (!s) notFound();
  const { partner: p, bank } = s;

  const link = referralLink(siteUrl(), p.code);
  const privateLink = token ? `${siteUrl()}/partner/${token}` : null;
  const firstName = p.name.trim().split(/\s+/)[0];
  const shareText = `Hello ${firstName}, here is your private Sabicars partner page: ${privateLink}. It shows your earnings and is where you add the bank account you are paid into. Keep it to yourself.`;
  const whatsapp = privateLink ? `https://wa.me/${p.phone.replace("+", "")}?text=${encodeURIComponent(shareText)}` : null;
  const owedMinor = s.totals.pendingMinor + s.totals.payableMinor;

  return (
    <>
      <Link href="/admin/partners" className="text-sm text-text-muted hover:text-text-primary">
        ← Partners
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-6">
        <div className="min-w-0">
          <p className="eyebrow">
            Partner · <span className="figures">{p.code}</span>
          </p>
          <h1 className="mt-2 text-display-3 break-words">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-text-secondary">
            <a href={`tel:${p.phone}`} className="figures text-text-primary hover:text-accent-text">
              {displayPhone(p.phone)}
            </a>
            {p.email && (
              <a href={`mailto:${p.email}`} className="break-all hover:text-text-primary">
                {p.email}
              </a>
            )}
            <span className="text-text-muted">Since {onDate(p.createdAt)}</span>
          </p>
        </div>
        <div className="sm:text-right">
          <p className={`text-sm ${p.status === "active" ? "text-success" : "text-danger"}`}>{p.status === "active" ? "Active" : "Suspended"}</p>
          <p className="figures mt-1 text-sm text-text-secondary">
            {s.enquiries.total} {s.enquiries.total === 1 ? "enquiry" : "enquiries"} · {s.enquiries.won} bought
          </p>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-3 gap-px border border-border-subtle bg-border-subtle">
        {[
          { label: "Owed", value: formatNaira(owedMinor), note: "pending and ready" },
          { label: "Ready to pay", value: formatNaira(s.totals.payableMinor), note: "past the cooling-off" },
          { label: "Paid", value: formatNaira(s.totals.paidMinor), note: "settled" },
        ].map((f) => (
          <div key={f.label} className="bg-surface-1 p-4 md:p-5">
            <dt className="text-xs text-text-muted">{f.label}</dt>
            <dd className="figures mt-1 text-xl font-semibold text-text-primary md:text-2xl">{f.value}</dd>
            <dd className="mt-0.5 text-xs text-text-muted">{f.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 grid gap-8 lg:col-start-1">
          <section aria-label="Their links" className="border border-border-subtle bg-surface-1 p-5 md:p-6">
            <p className="eyebrow !text-text-muted">Their referral link</p>
            <p className="figures mt-2 break-all text-sm text-text-primary">{link}</p>
            <p className="mt-1 text-xs text-text-muted">A buyer who opens it is recorded against {p.code} from their first enquiry.</p>

            <p className="eyebrow mt-6 !text-text-muted">Share their private page</p>
            {privateLink ? (
              <>
                <p className="mt-2 text-sm text-text-secondary">
                  Their earnings, and where they add the bank account they are paid into. It is theirs alone: send it only to{" "}
                  <span className="text-text-primary">{displayPhone(p.phone)}</span>, and never post it anywhere.
                </p>
                <p className="figures mt-3 break-all text-sm text-text-primary">{privateLink}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full bg-cta px-4 text-sm font-semibold text-cta-fg hover:bg-cta-hover"
                    >
                      Send on WhatsApp
                    </a>
                  )}
                  <CopyLink link={privateLink} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No private link on record for this partner.</p>
            )}
          </section>

          <section aria-label="Commissions" className="min-w-0">
            <p className="eyebrow !text-text-muted">Commissions</p>
            {s.commissions.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Nothing earned yet. A commission appears when a buyer they brought completes a purchase and the car is marked sold with its price.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto border-y border-border-subtle">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted">
                      <th className="py-2 pr-4 font-normal">Vehicle</th>
                      <th className="py-2 pr-4 font-normal">Sold for</th>
                      <th className="py-2 pr-4 font-normal">Commission</th>
                      <th className="py-2 pr-4 font-normal">Where it stands</th>
                      <th className="py-2 font-normal">Earned</th>
                      <th className="py-2 pl-4 font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {s.commissions.map((c) => {
                      const state = commissionState(c);
                      return (
                        <tr key={c.id} className="align-top">
                          <td className="py-3 pr-4">
                            <Link href={`/admin/vehicles/${c.vehicleId}`} className="text-text-primary hover:text-accent-text">
                              {c.vehicleTitle}
                            </Link>
                            <span className="block text-xs text-text-muted">via {SOURCE_LABEL[c.source] ?? c.source}</span>
                          </td>
                          <td className="figures py-3 pr-4 text-text-secondary">{formatNaira(c.salePriceMinor)}</td>
                          <td className="figures py-3 pr-4 text-text-primary">{formatNaira(c.amountMinor)}</td>
                          <td className={`py-3 pr-4 ${state.tone}`}>
                            <span className="block text-xs text-text-muted">{COMMISSION_STATUS_LABEL[c.status]}</span>
                            {state.text}
                          </td>
                          <td className="figures py-3 text-text-secondary">{onDate(c.earnedAt)}</td>
                          <td className="py-3 pl-4 text-right">{c.status === "pending" && <VoidCommission commissionId={c.id} amountLabel={formatNaira(c.amountMinor)} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Payouts" className="min-w-0">
            <p className="eyebrow !text-text-muted">Payouts</p>
            {s.payouts.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                Nothing paid yet. Payments are made from{" "}
                <Link href="/admin/payouts" className="font-semibold text-accent-text hover:text-text-primary">
                  Payouts
                </Link>{" "}
                once a commission is past its cooling-off and the account is verified.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto border-y border-border-subtle">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted">
                      <th className="py-2 pr-4 font-normal">Date</th>
                      <th className="py-2 pr-4 font-normal">Vehicle</th>
                      <th className="py-2 pr-4 font-normal">Amount</th>
                      <th className="py-2 pr-4 font-normal">How</th>
                      <th className="py-2 pr-4 font-normal">Status</th>
                      <th className="py-2 font-normal">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {s.payouts.map((po) => (
                      <tr key={po.id} className="align-top">
                        <td className="figures py-3 pr-4 text-text-secondary">{onDate(po.paidAt ?? po.createdAt)}</td>
                        <td className="py-3 pr-4 text-text-primary">{po.vehicleTitle}</td>
                        <td className="figures py-3 pr-4 text-text-primary">
                          {formatNaira(po.amountMinor)}
                          {po.feeMinor !== null && po.feeMinor > 0 && <span className="block text-xs text-text-muted">+ {formatNaira(po.feeMinor)} fee</span>}
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">
                          {METHOD_LABEL[po.method] ?? po.method}
                          {po.bankName && (
                            <span className="figures block text-xs text-text-muted">
                              {po.bankName} {po.accountMasked}
                            </span>
                          )}
                          {po.recordedByName && <span className="block text-xs text-text-muted">by {po.recordedByName}</span>}
                        </td>
                        <td className={`py-3 pr-4 ${po.status === "paid" ? "text-success" : po.status === "failed" || po.status === "reversed" ? "text-danger" : "text-text-secondary"}`}>
                          {PAYOUT_STATUS_LABEL[po.status]}
                          {po.failureReason && <span className="block text-xs text-text-muted">{po.failureReason}</span>}
                        </td>
                        <td className="figures py-3 text-xs text-text-muted">
                          {po.reference}
                          {po.bankReference && <span className="block">Bank ref {po.bankReference}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-8 lg:col-start-2 lg:row-start-1">
          <section aria-label="Bank account" className="border border-border-subtle bg-surface-1 p-5">
            <p className="eyebrow !text-text-muted">Bank account</p>
            {bank ? (
              <>
                <p className="mt-3 text-text-primary">{bank.bankName}</p>
                <p className="figures text-sm text-text-secondary">{bank.accountMasked}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {bank.accountName ? (
                    <>
                      Name the bank returned: <span className="text-text-primary">{bank.accountName}</span>
                    </>
                  ) : (
                    "The bank did not return a name for this account."
                  )}
                </p>
                {bank.verifiedAt ? (
                  <p className="mt-3 text-sm text-success">
                    Verified on {onDate(bank.verifiedAt)} {bank.verifiedBy ? `by ${bank.verifiedBy}` : "automatically"}
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-accent-text">Not verified — confirm only after checking the account is in the partner&rsquo;s own name.</p>
                    <div className="mt-4">
                      <ConfirmAccount partnerId={p.id} partnerName={p.name} />
                    </div>
                  </>
                )}
                {bank.verifiedAt && !bank.recipientReady && (
                  <p className="mt-2 text-xs text-text-muted">Not yet registered with Paystack; it is registered on the first Paystack payout.</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-text-muted">No account yet. The partner adds it on their private page; it must be in their own name.</p>
            )}
          </section>

          <section aria-label="Status" className="border border-border-subtle bg-surface-1 p-5">
            <p className="eyebrow !text-text-muted">Status</p>
            <p className={`mt-3 text-sm ${p.status === "active" ? "text-text-primary" : "text-danger"}`}>{p.status === "active" ? "Active" : "Suspended"}</p>
            <div className="mt-4">
              <PartnerStatusControl partnerId={p.id} status={p.status} partnerName={firstName} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
