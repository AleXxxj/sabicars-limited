import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { ShowroomDepositForm } from "@/components/admin/ShowroomDepositForm";
import { can, requireStaff } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { displayPhone } from "@/lib/phone";
import { listedVehicles } from "@/lib/repositories/vehicles";
import { RESERVATION_STATUS_LABEL, reservationsFor, type ReservationRow } from "@/lib/reserve";
import { refundFor, type ReservationStatus } from "@/lib/reservations";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Reservations · Admin", robots: { index: false, follow: false } };

const when = (d: Date) => new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
const day = (d: Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
const daysLeft = (until: Date, now: Date) => Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));

const TONE: Record<ReservationStatus, string> = {
  pending: "bg-white/[0.06] text-text-secondary",
  held: "bg-green-500/15 text-green-200",
  expired: "bg-orange-500/15 text-orange-200",
  completed: "bg-success/15 text-success",
  refunded: "bg-white/[0.06] text-text-secondary",
  cancelled: "bg-white/[0.06] text-text-muted",
};

/**
 * Every deposit: who is holding which car until when, deposits waiting for
 * payment, and what became of the rest. A deposit taken in the showroom is
 * recorded here, so the site stops offering the car.
 */
export default async function ReservationsAdmin() {
  const me = await requireStaff();
  const now = new Date();
  const [rows, stock] = await Promise.all([reservationsFor(me.dealerId), listedVehicles()]);
  const forSale = stock.filter((v) => v.status === "available" && v.priceMinor).map((v) => ({ id: v.id, title: vehicleTitle(v), price: priceLabel(v) }));
  const holding = rows.filter((r) => r.status === "held");
  const waiting = rows.filter((r) => r.status === "pending");
  // Money that arrived on a closed attempt, or that did not match: a manager must decide, so it sits at the top.
  const needsDecision = rows.filter((r) => r.paidAt && (r.status === "cancelled" || r.status === "expired"));
  const past = rows.filter((r) => !["held", "pending"].includes(r.status) && !needsDecision.includes(r)).slice(0, 60);

  const Row = ({ r }: { r: ReservationRow }) => (
    <li className="grid gap-3 border border-border-subtle bg-surface-1 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[r.status]}`}>{RESERVATION_STATUS_LABEL[r.status]}</span>
          <span>{when(r.createdAt)}</span>
          <span>· {r.source === "showroom" ? `at the showroom (${r.channel ?? "cash"})` : `online (${r.channel ?? "Paystack"})`}</span>
          <span className="figures">· {r.reference}</span>
        </div>
        <p className="mt-2 font-semibold text-text-primary">
          <span className="figures">{formatNaira(r.amountMinor)}</span>
          {r.paidMinor !== null && r.paidMinor !== r.amountMinor && <span className="font-normal text-orange-200"> (received {formatNaira(r.paidMinor)})</span>} on the{" "}
          <Link href={`/admin/vehicles/${r.vehicleId}`} className="text-green-300 hover:text-green-200">
            {r.vehicleTitle}
          </Link>{" "}
          <span className="font-normal text-text-muted">({formatNaira(r.priceMinor)})</span>
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {r.buyerName} ·{" "}
          <a href={`tel:${r.buyerPhone}`} className="figures text-text-primary">
            {displayPhone(r.buyerPhone)}
          </a>
          {r.buyerEmail && <> · {r.buyerEmail}</>}
          {r.leadId && (
            <>
              {" "}
              ·{" "}
              <Link href={`/admin/leads/${r.leadId}`} className="text-green-300 hover:text-green-200">
                enquiry
              </Link>
            </>
          )}
        </p>
        {r.status === "held" && r.holdsUntil && (
          <p className="mt-1 text-sm text-text-secondary">
            Holds the car until <strong className="text-text-primary">{day(r.holdsUntil)}</strong> ({daysLeft(r.holdsUntil, now)} days left).
          </p>
        )}
        {r.status === "refunded" && r.refundMinor !== null && (
          <p className="mt-1 text-sm text-text-secondary">
            Refunded {formatNaira(r.refundMinor)}; {formatNaira(r.amountMinor - r.refundMinor)} kept as the charge.
          </p>
        )}
        {r.note && <p className="mt-1 text-xs text-text-muted">{r.note}</p>}
      </div>
      <ReservationActions id={r.id} status={r.status} paid={Boolean(r.paidAt)} manager={can.setPrices(me)} refundLabel={`${formatNaira(refundFor(r.paidMinor ?? r.amountMinor).refundMinor)} back`} />
    </li>
  );

  return (
    <>
      <LiveRefresh />
      <p className="eyebrow">Deposits</p>
      <h1 className="mt-2 text-display-3">Reservations</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        A deposit holds a car for one buyer: ₦500,000 for a week, 40% or more for a month. A refund returns the deposit less 18%. Record a
        deposit taken at the showroom here, and the site stops offering that car.
      </p>

      {needsDecision.length > 0 && (
        <section className="mt-8 border border-orange-400/40 bg-orange-500/[0.05] p-5">
          <h2 className="text-lg font-semibold text-text-primary">
            Money waiting for a decision <span className="figures text-sm text-text-muted">{needsDecision.length}</span>
          </h2>
          <p className="mt-1 text-sm text-text-secondary">A deposit arrived after its attempt closed, its hold ran out, or it did not match. Hold the car for the buyer again, complete the sale, or refund.</p>
          <ul className="mt-4 grid gap-3">
            {needsDecision.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          Holding a car now <span className="figures text-sm text-text-muted">{holding.length}</span>
        </h2>
        {holding.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No car is held by a deposit right now.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {holding.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-text-primary">
            Started online, not paid yet <span className="figures text-sm text-text-muted">{waiting.length}</span>
          </h2>
          <p className="mt-1 text-sm text-text-muted">An unpaid attempt keeps its place for 30 minutes, then it is closed and the car is open again. These buyers are worth a call.</p>
          <ul className="mt-4 grid gap-3">
            {waiting.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 border border-border-subtle bg-surface-1 p-5 md:p-6">
        <h2 className="text-lg font-semibold text-text-primary">Record a deposit taken at the showroom</h2>
        <p className="mt-1 mb-5 text-sm text-text-muted">Cash, POS or a transfer to the bank. The car is held for the buyer from now, for a week or a month by the amount.</p>
        {forSale.length ? <ShowroomDepositForm vehicles={forSale} /> : <p className="text-sm text-text-muted">No priced car is available to reserve.</p>}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-text-primary">Past</h2>
          <ul className="mt-4 grid gap-3">
            {past.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
