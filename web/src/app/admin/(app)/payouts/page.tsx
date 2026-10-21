import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PayViaPaystack, RecordBankTransfer, type PayoutTarget } from "@/components/admin/PayoutActions";
import { can, requireStaff } from "@/lib/auth";
import { payoutQueue, type PayoutRow, type QueueRow } from "@/lib/ledger";
import { COOLING_OFF_HOURS, PAYOUT_STATUS_LABEL } from "@/lib/ledger-rules";
import { formatNaira } from "@/lib/money";
import { paystackTestMode } from "@/lib/paystack";

export const metadata: Metadata = { title: "Payouts · Admin", robots: { index: false, follow: false } };

const dateLagos = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const whenLagos = (d: Date) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

const METHOD_LABEL: Record<string, string> = { paystack: "Paystack transfer", bank_transfer: "Bank transfer" };

/** The account a row's commission is paid into, for the confirm step — or null while the partner has none. */
function targetOf(r: QueueRow): PayoutTarget | null {
  if (!r.bank) return null;
  return { commissionId: r.id, amountMinor: r.amountMinor, bankName: r.bank.bankName, accountMasked: r.bank.accountMasked, holder: r.bank.accountName ?? r.partnerName };
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="kicker">
        {title} <span className="figures text-text-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="mt-4 text-sm text-text-muted">{empty}</p> : <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">{children}</ul>}
    </section>
  );
}

/** Who is being paid, for what — the first two lines of every row. */
function Who({ partnerId, partnerName, partnerCode, vehicle }: { partnerId: string; partnerName: string; partnerCode: string; vehicle: React.ReactNode }) {
  return (
    <>
      <p className="font-medium text-text-primary">
        <Link href={`/admin/partners/${partnerId}`} className="hover:text-accent-text">
          {partnerName}
        </Link>{" "}
        <span className="figures text-sm text-text-muted">{partnerCode}</span>
      </p>
      <p className="mt-1 text-sm text-text-secondary">{vehicle}</p>
    </>
  );
}

/** Where the money would go, and whether it may. */
function BankLine({ r }: { r: QueueRow }) {
  if (!r.bank)
    return (
      <p className="mt-2 text-sm text-text-muted">
        No bank account registered yet — the partner adds it on their own page.
      </p>
    );
  const { bankName, accountMasked, accountName, verifiedAt, verifiedBy } = r.bank;
  return (
    <p className="mt-2 text-sm text-text-secondary">
      {bankName} <span className="figures">{accountMasked}</span>
      {accountName && ` · ${accountName}`}
      {verifiedAt ? (
        <span className="text-success"> · verified{verifiedBy ? ` by ${verifiedBy}` : ""}</span>
      ) : (
        <>
          <span className="text-accent-text"> · not verified yet</span> —{" "}
          <Link href={`/admin/partners/${r.partnerId}`} className="text-text-primary underline-offset-4 hover:underline">
            check it on the partner’s page
          </Link>
        </>
      )}
    </p>
  );
}

/** The two ways to pay, as the row allows them; the reason when Paystack is not offered. */
function Actions({ r }: { r: QueueRow }) {
  const target = targetOf(r);
  const canRecord = Boolean(r.bank?.verifiedAt) && r.partnerStatus === "active";
  return (
    <div className="grid content-start gap-3">
      {r.blocked === null && target ? <PayViaPaystack target={target} /> : <p className="text-sm text-text-muted">{r.blocked ?? "Paystack is not offered for this one."}</p>}
      {canRecord && target && <RecordBankTransfer target={target} />}
    </div>
  );
}

function PaidRow({ p }: { p: PayoutRow }) {
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
      <p className="text-text-muted">{dateLagos(p.paidAt ?? p.createdAt)}</p>
      <div className="min-w-0">
        <p className="text-text-primary">
          <Link href={`/admin/partners/${p.partnerId}`} className="hover:text-accent-text">
            {p.partnerName}
          </Link>{" "}
          <span className="text-text-muted">· {p.vehicleTitle}</span>
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {METHOD_LABEL[p.method] ?? p.method}
          {p.bankName && (
            <>
              {" "}
              to {p.bankName} <span className="figures">{p.accountMasked}</span>
            </>
          )}{" "}
          · ref <span className="figures">{p.method === "bank_transfer" ? (p.bankReference ?? p.reference) : (p.transferCode ?? p.reference)}</span>
          {p.recordedByName && ` · ${p.method === "bank_transfer" ? "recorded" : "sent"} by ${p.recordedByName}`}
        </p>
      </div>
      <p className="figures text-text-primary sm:text-right">{formatNaira(p.amountMinor)}</p>
    </li>
  );
}

/**
 * Paying partners: what Sabicars owes and is ready to pay, what is still in
 * its cooling-off, what is with the bank, what failed, and what was paid.
 * Nothing here moves money on one tap, and nothing is paid before the
 * cooling-off or into an account that is not the partner's own.
 */
export default async function Payouts() {
  const me = await requireStaff();
  if (!can.payPartners(me)) redirect("/admin/vehicles");
  const q = await payoutQueue(me.dealerId);
  const testMode = q.paystack.configured && paystackTestMode();
  const owedMinor = q.payable.reduce((s, r) => s + r.amountMinor, 0);
  const failedFor = new Set(q.failed.map((f) => f.commissionId));
  const payableBy = new Map(q.payable.map((r) => [r.id, r]));

  return (
    <>
      <p className="eyebrow">Refer &amp; Earn</p>
      <h1 className="mt-2 text-display-3">Payouts</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        A partner earns 1.5% of what the car actually sold for when a buyer they brought completes a purchase — one commission per vehicle, paid once,{" "}
        {COOLING_OFF_HOURS} hours after the sale, into a bank account in their own name. Pay it from Sabicars’ Paystack balance, or record a transfer made
        from the bank.
      </p>

      <section className="surface-card mt-8 p-5 md:p-6" aria-label="Paystack">
        <p className="eyebrow !text-text-muted">Paystack</p>
        {!q.paystack.configured ? (
          <p className="mt-2 text-sm text-text-secondary">Payouts are recorded as bank transfers until the Paystack key is added in Vercel.</p>
        ) : q.paystack.error ? (
          <p className="mt-2 text-sm text-danger">{q.paystack.error}</p>
        ) : (
          <>
            <p className="figures mt-2 text-2xl text-text-primary">{formatNaira(q.paystack.balanceMinor ?? 0)}</p>
            <p className="mt-1 text-sm text-text-secondary">
              Balance available for transfers.
              {owedMinor > 0 && ` ${formatNaira(owedMinor)} is ready to pay.`}
            </p>
            {testMode && (
              <p className="mt-3 border-l-2 border-warning pl-3 text-sm text-accent-text">
                This is a test key: transfers settle at once and no money moves. Replace it with the live key in Vercel before paying partners.
              </p>
            )}
          </>
        )}
      </section>

      <Section title="Ready to pay" count={q.payable.length} empty="Nothing is waiting to be paid.">
        {q.payable.map((r) => (
          <li key={r.id} id={`commission-${r.id}`} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <Who
                partnerId={r.partnerId}
                partnerName={r.partnerName}
                partnerCode={r.partnerCode}
                vehicle={
                  <>
                    <Link href={`/admin/vehicles/${r.vehicleId}`} className="hover:text-text-primary">
                      {r.vehicleTitle}
                    </Link>{" "}
                    · sold for <span className="figures">{formatNaira(r.salePriceMinor)}</span>
                    {r.source === "manual" && " · attributed by hand"}
                  </>
                }
              />
              <p className="figures mt-2 text-lg text-text-primary">{formatNaira(r.amountMinor)}</p>
              <p className="text-xs text-text-muted">Payable since {whenLagos(r.payableAt)}</p>
              <BankLine r={r} />
              {failedFor.has(r.id) && <p className="mt-1 text-xs text-text-muted">An earlier transfer failed — the reason is under Failed, below.</p>}
            </div>
            <Actions r={r} />
          </li>
        ))}
      </Section>

      <Section title="In cooling-off" count={q.cooling.length} empty="No sale is waiting out its cooling-off.">
        {q.cooling.map((r) => (
          <li key={r.id} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <Who
                partnerId={r.partnerId}
                partnerName={r.partnerName}
                partnerCode={r.partnerCode}
                vehicle={
                  <>
                    <Link href={`/admin/vehicles/${r.vehicleId}`} className="hover:text-text-primary">
                      {r.vehicleTitle}
                    </Link>{" "}
                    · sold {dateLagos(r.earnedAt)}
                  </>
                }
              />
              <p className="mt-1 text-sm text-text-secondary">Payable from {whenLagos(r.payableAt)}</p>
              {!r.bank ? (
                <p className="mt-1 text-xs text-text-muted">No bank account yet — a good moment to remind the partner.</p>
              ) : !r.bank.verifiedAt ? (
                <p className="mt-1 text-xs text-text-muted">The bank account is not verified yet.</p>
              ) : null}
            </div>
            <p className="figures text-text-primary sm:text-right">{formatNaira(r.amountMinor)}</p>
          </li>
        ))}
      </Section>

      <Section title="With the bank" count={q.processing.length} empty="No transfer is in flight.">
        {q.processing.map((p) => (
          <li key={p.id} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <Who partnerId={p.partnerId} partnerName={p.partnerName} partnerCode={p.partnerCode} vehicle={p.vehicleTitle} />
              <p className="mt-1 text-xs text-text-muted">
                {PAYOUT_STATUS_LABEL[p.status]} · sent {whenLagos(p.createdAt)}
                {p.bankName && (
                  <>
                    {" "}
                    to {p.bankName} <span className="figures">{p.accountMasked}</span>
                  </>
                )}{" "}
                · ref <span className="figures">{p.transferCode ?? p.reference}</span>
              </p>
            </div>
            <p className="figures text-text-primary sm:text-right">{formatNaira(p.amountMinor)}</p>
          </li>
        ))}
      </Section>

      <Section title="Failed" count={q.failed.length} empty="No transfer has failed.">
        {q.failed.map((f) => {
          const row = payableBy.get(f.commissionId);
          return (
            <li key={f.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0">
                <Who partnerId={f.partnerId} partnerName={f.partnerName} partnerCode={f.partnerCode} vehicle={f.vehicleTitle} />
                <p className="figures mt-2 text-lg text-text-primary">{formatNaira(f.amountMinor)}</p>
                <p className="mt-1 text-sm text-danger">
                  {PAYOUT_STATUS_LABEL[f.status]} {whenLagos(f.createdAt)}: {f.failureReason ?? "Paystack gave no reason."}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {METHOD_LABEL[f.method] ?? f.method}
                  {f.bankName && (
                    <>
                      {" "}
                      to {f.bankName} <span className="figures">{f.accountMasked}</span>
                    </>
                  )}{" "}
                  · ref <span className="figures">{f.transferCode ?? f.reference}</span>
                </p>
                {row && <BankLine r={row} />}
              </div>
              {row ? <Actions r={row} /> : <p className="text-sm text-text-muted">This commission is no longer waiting to be paid.</p>}
            </li>
          );
        })}
      </Section>

      <Section title="Paid" count={q.recent.length} empty="Nothing has been paid yet.">
        {q.recent.map((p) => (
          <PaidRow key={p.id} p={p} />
        ))}
      </Section>
    </>
  );
}
