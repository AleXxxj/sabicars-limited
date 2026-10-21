import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, requireStaff } from "@/lib/auth";
import { partnerOverview, type PartnerSummary } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";
import { displayPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Partners · Admin", robots: { index: false, follow: false } };

const BANK_LABEL: Record<PartnerSummary["bankStatus"], string> = {
  none: "No bank account",
  unverified: "Account not verified",
  verified: "Account verified",
};

/**
 * Everyone in Refer & Earn: what each partner has brought in, what Sabicars
 * owes them and what it has paid. Active partners first, newest first within
 * that. Paying happens on the Payouts page; this is the people.
 */
export default async function Partners() {
  const me = await requireStaff();
  if (!can.payPartners(me)) redirect("/admin/vehicles");

  const rows = (await partnerOverview(me.dealerId)).sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const owed = rows.reduce((n, r) => n + r.totals.pendingMinor + r.totals.payableMinor, 0);
  const ready = rows.reduce((n, r) => n + r.totals.payableMinor, 0);
  const paid = rows.reduce((n, r) => n + r.totals.paidMinor, 0);

  return (
    <>
      <p className="eyebrow">Refer &amp; Earn</p>
      <h1 className="mt-2 text-display-3">Partners</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        People who bring buyers. Each earns 1.5% of what a car they referred sold for, paid after a 48-hour cooling-off into a bank account in their own name.{" "}
        <Link href="/admin/payouts" className="font-semibold text-accent-text hover:text-text-primary">
          Pay what is ready on Payouts →
        </Link>
      </p>

      {rows.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle lg:grid-cols-4">
          {[
            { label: "Partners", value: String(rows.length), note: `${rows.filter((r) => r.status === "active").length} active` },
            { label: "Owed", value: formatNaira(owed), note: "pending and ready to pay" },
            { label: "Ready to pay", value: formatNaira(ready), note: "past the cooling-off" },
            { label: "Paid so far", value: formatNaira(paid), note: "every commission settled" },
          ].map((f) => (
            <div key={f.label} className="bg-surface-1 p-4 md:p-5">
              <dt className="text-xs text-text-muted">{f.label}</dt>
              <dd className="figures mt-1 text-2xl font-semibold text-text-primary">{f.value}</dd>
              <dd className="mt-0.5 text-xs text-text-muted">{f.note}</dd>
            </div>
          ))}
        </dl>
      )}

      {rows.length > 0 ? (
        <ul className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
          {rows.map((p) => {
            const owedMinor = p.totals.pendingMinor + p.totals.payableMinor;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/partners/${p.id}`}
                  className="grid gap-3 py-4 hover:bg-surface-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-medium text-text-primary">
                      <span className="break-words">{p.name}</span>
                      <span className="figures text-xs text-text-muted">{p.code}</span>
                      {p.status === "suspended" && <span className="text-xs text-danger">Suspended</span>}
                    </p>
                    <p className="figures mt-0.5 text-sm text-text-muted">{displayPhone(p.phone)}</p>
                  </div>
                  <p className="text-sm text-text-secondary">
                    <span className="figures">{p.enquiries}</span> {p.enquiries === 1 ? "enquiry" : "enquiries"} · <span className="figures">{p.won}</span> bought
                    <span className={`block text-xs ${p.bankStatus === "verified" ? "text-success" : p.bankStatus === "unverified" ? "text-accent-text" : "text-text-muted"}`}>
                      {BANK_LABEL[p.bankStatus]}
                    </span>
                  </p>
                  <p className="figures text-sm sm:text-right">
                    <span className={owedMinor > 0 ? "text-text-primary" : "text-text-muted"}>Owed {formatNaira(owedMinor)}</span>
                    {p.totals.payableMinor > 0 && <span className="block text-xs text-accent-text">{formatNaira(p.totals.payableMinor)} ready to pay</span>}
                    <span className="block text-xs text-text-muted">Paid {formatNaira(p.totals.paidMinor)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-muted">
          No partners yet. People join through the Refer &amp; Earn page on the site, and appear here with their code.
        </p>
      )}
    </>
  );
}
