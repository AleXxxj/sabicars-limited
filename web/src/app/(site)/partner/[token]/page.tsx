import type { Metadata } from "next";
import { ReferralShare } from "@/components/forms/PartnerForm";
import { BankAccountForm, type CurrentAccount } from "@/components/partner/BankAccountForm";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { banksForForm } from "@/lib/banks";
import { partnerByToken, type CommissionRow, type PayoutRow } from "@/lib/ledger";
import { COOLING_OFF_HOURS, PAYOUT_STATUS_LABEL } from "@/lib/ledger-rules";
import { formatNaira } from "@/lib/money";
import { referralLink } from "@/lib/partners";
import { site, siteUrl, whatsappLink } from "@/lib/site";

/** No referrer: the address carries the partner's private token, and no link out of this page may leak it. */
export const metadata: Metadata = { title: "Your partner page", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Personal: never cached, never shared between two visitors. */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const TOKEN = /^[0-9a-f-]{36}$/i;

const longDate = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const COOLING_DAYS = COOLING_OFF_HOURS / 24;
const coolingOff = COOLING_DAYS === 1 ? "one day" : COOLING_DAYS === 2 ? "two days" : `${COOLING_DAYS} days`;

const METHOD_LABEL: Record<string, string> = { paystack: "Paystack transfer", bank_transfer: "Bank transfer" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Where a commission stands, in the partner's terms: when it is paid, that it was, or why it will not be. */
function commissionStatus(c: CommissionRow): string {
  if (c.status === "paid") return `Paid ${c.paidAt ? longDate(c.paidAt) : ""}`.trim();
  if (c.status === "void") return `Void — ${c.voidReason ?? "the sale did not go through"}`;
  return c.payable ? "Ready: Sabicars pays it next" : `Paid after ${longDate(c.payableAt)}`;
}

function payoutNote(p: PayoutRow): string | null {
  if (p.status === "failed" || p.status === "reversed") return "This transfer did not go through. Your commission is still owed, and Sabicars will send it again.";
  if (p.status === "pending" || p.status === "processing") return "On its way: the bank has not confirmed it yet.";
  return null;
}

/**
 * A partner's own page, opened with the private token in their link. Everything
 * on it is theirs: the enquiries they brought, each commission and where it
 * stands, every payment made, and the one bank account they are paid into.
 * A GET never changes anything; the bank form posts to a server action.
 */
export default async function PartnerPage({ params }: Props) {
  const { token } = await params;
  const statement = TOKEN.test(token) ? await partnerByToken(token) : null;

  if (!statement) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <p className="kicker">Refer &amp; Earn</p>
        <h1 className="mt-4 text-display-3">This link is not valid.</h1>
        <p className="mt-4 text-text-secondary">
          It may have been copied incompletely. Register again with the same phone number and your page link is shown again, or ask the
          Sabicars team for it.
        </p>
        <ButtonLink href="/partners#register" variant="secondary" className="mt-8">
          Go to Refer &amp; Earn
        </ButtonLink>
      </section>
    );
  }

  const { partner, bank, enquiries, commissions, payouts, totals } = statement;
  const firstName = partner.name.split(" ")[0];
  const suspended = partner.status !== "active";
  const link = referralLink(siteUrl(), partner.code);
  const banks = suspended ? [] : await banksForForm();
  const current: CurrentAccount | null = bank
    ? { bankName: bank.bankName, bankCode: bank.bankCode, accountMasked: bank.accountMasked, accountName: bank.accountName, verified: Boolean(bank.verifiedAt) }
    : null;
  const phone = site.phones[0];
  const whatsapp = whatsappLink(`Hello Sabicars, I am partner ${partner.code} and I have a question about my commission.`);

  const figures: [string, number][] = [
    ["In cooling-off", totals.pendingMinor],
    ["Ready to be paid", totals.payableMinor],
    ["Paid", totals.paidMinor],
  ];

  return (
    <>
      <PageIntro eyebrow="Refer & Earn" title={`Hello, ${firstName}.`}>
        <p>
          Your partner code is <span className="figures text-text-primary">{partner.code}</span>. This page is yours alone: what you have
          brought in, what you have earned, and the account you are paid into.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-4xl space-y-14 px-5 py-12 md:px-10 md:py-16">
        {suspended && (
          <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-primary">
            This partner account is suspended. Payments are paused and your link no longer records new buyers. Call Sabicars on{" "}
            <a href={`tel:${phone.e164}`} className="figures">
              {phone.display}
            </a>{" "}
            to talk about it.
          </p>
        )}

        <section className="surface-card p-6 md:p-8">
          <ReferralShare link={link} />
          <p className="mt-6 text-sm leading-relaxed text-text-muted">
            Anyone who opens this link and then enquires is recorded against your code. Buyers who visit the showroom can simply give
            your code.
          </p>
        </section>

        <section>
          <p className="kicker">Your earnings</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {figures.map(([label, minor]) => (
              <div key={label} className="surface-card p-5 md:p-6">
                <dt className="text-sm text-text-muted">{label}</dt>
                <dd className={`figures mt-2 font-display text-[1.9rem] leading-none ${minor > 0 ? "text-brand" : "text-text-secondary"}`}>{formatNaira(minor)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm text-text-secondary">
            <span className="figures text-text-primary">{plural(enquiries.total, "enquiry", "enquiries")}</span> through your link so far ·{" "}
            <span className="figures text-text-primary">{enquiries.won}</span> bought.
          </p>
        </section>

        <section>
          <p className="kicker">Your commissions</p>
          {commissions.length ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-border-default bg-surface-1">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Vehicle
                    </th>
                    <th scope="col" className="hidden px-5 py-3 font-medium sm:table-cell">
                      Sold for
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Commission
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {commissions.map((c) => (
                    <tr key={c.id} className={c.status === "void" ? "text-text-muted" : "text-text-secondary"}>
                      <td className="px-5 py-4 align-top">
                        <p className={c.status === "void" ? "" : "text-text-primary"}>{c.vehicleTitle}</p>
                        <p className="figures mt-1 text-xs text-text-muted sm:hidden">Sold for {formatNaira(c.salePriceMinor)}</p>
                      </td>
                      <td className="figures hidden px-5 py-4 align-top sm:table-cell">{formatNaira(c.salePriceMinor)}</td>
                      <td className={`figures px-5 py-4 align-top ${c.status === "void" ? "line-through" : "text-text-primary"}`}>{formatNaira(c.amountMinor)}</td>
                      <td className="px-5 py-4 align-top">{commissionStatus(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-muted">
              No sales yet. When a buyer you brought completes a purchase, the commission appears here with the day it is paid.
            </p>
          )}
        </section>

        <section>
          <p className="kicker">Payments</p>
          {payouts.length ? (
            <ul className="mt-6 divide-y divide-border-subtle rounded-2xl border border-border-default bg-surface-1">
              {payouts.map((p) => {
                const note = payoutNote(p);
                return (
                  <li key={p.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                    <div>
                      <p className="text-text-primary">
                        {METHOD_LABEL[p.method] ?? p.method}
                        {p.status !== "paid" && <span className="text-text-muted"> · {PAYOUT_STATUS_LABEL[p.status]}</span>}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {[p.bankName, p.accountMasked].filter(Boolean).join(" ")}
                        {p.bankName || p.accountMasked ? " · " : ""}
                        {p.vehicleTitle}
                      </p>
                      <p className="figures mt-1 text-xs text-text-muted">
                        Ref. {p.reference}
                        {p.bankReference && ` · Bank ref. ${p.bankReference}`}
                      </p>
                      {note && <p className="mt-1 text-xs text-text-muted">{note}</p>}
                    </div>
                    <div className="sm:text-right">
                      <p className="figures text-text-primary">{formatNaira(p.amountMinor)}</p>
                      <p className="mt-1 text-xs text-text-muted">{longDate(p.paidAt ?? p.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-6 border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-muted">
              No payments yet. Each one is listed here with its reference once it is made.
            </p>
          )}
        </section>

        <section id="bank" className="surface-card scroll-mt-24 p-6 md:p-8">
          <p className="kicker">Where you are paid</p>
          <h2 className="mt-4 text-display-3">Your bank account</h2>
          <p className="mt-3 text-text-secondary">
            One account, in your own name. Sabicars pays into it by bank transfer, and nowhere else.
          </p>
          <div className="mt-6">
            {suspended ? (
              <p className="text-sm text-text-muted">
                {current ? (
                  <>
                    Registered: {current.bankName} · <span className="figures">{current.accountMasked}</span>. It cannot be changed while the
                    account is suspended.
                  </>
                ) : (
                  "A bank account cannot be registered while the account is suspended."
                )}
              </p>
            ) : (
              <BankAccountForm token={token} partnerName={partner.name} banks={banks} current={current} />
            )}
          </div>
        </section>

        <section className="border-t border-border-subtle pt-10">
          <p className="kicker">How you are paid</p>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary marker:text-green-400">
            <li>One commission per sale: 1.5% of what the vehicle actually sold for, recorded against you when a buyer you brought completes a purchase. Fleet orders count in full.</li>
            <li>It is paid once the sale is final, after a cooling-off of {coolingOff}. If the sale falls through before then, the commission is void and the reason is shown above.</li>
            <li>Only into a bank account in your own name. The account holder&rsquo;s name is checked before your first payout, so nobody else can collect what you earned.</li>
            <li>You never pay Sabicars anything — not to register, not to be paid, not ever. Anyone asking you to pay is not Sabicars.</li>
            <li>You earn from buyers you bring, never from signing up other partners.</li>
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-text-secondary">
            A question about a sale or a payment? Call{" "}
            <a href={`tel:${phone.e164}`} className="figures text-text-primary hover:text-accent-text">
              {phone.display}
            </a>{" "}
            or{" "}
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2 hover:text-accent-text">
              message Sabicars on WhatsApp
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
