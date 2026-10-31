import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { formatNaira } from "@/lib/money";
import { settleReturn } from "@/lib/reserve";
import { refundFor } from "@/lib/reservations";
import { site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = { title: "Your deposit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Card({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-7 md:p-10">
      <p className="kicker">{kicker}</p>
      <h1 className="mt-3 text-display-3">{title}</h1>
      {children}
    </div>
  );
}

/**
 * Where Paystack sends the buyer back. What it says comes from Paystack's
 * record of the payment, checked by the server, never from the address bar:
 * a reference alone proves nothing. Paystack appends its own ?trxref= and
 * ?reference= to the address, so both are read, and a repeated one is fine.
 */
export default async function ReserveDonePage({ searchParams }: Props) {
  const sp = await searchParams;
  const reference = (first(sp.reference) || first(sp.trxref)).trim();
  if (!/^scr_[a-z0-9]{8,24}$/.test(reference)) notFound();
  const { outcome, reservation: r, title, slug } = await settleReturn(reference);
  if (!r || outcome === "unknown") notFound();
  const car = title ?? "the car";
  const wa = whatsappLink(`Hello Sabicars, about my deposit on the ${car} (reference ${reference}).`);
  const paid = r.paidMinor ?? r.amountMinor;
  // Less than the deposit asked for arrived: a manager decides what it holds.
  const short = r.paidAt !== null && paid < r.amountMinor;
  const whatsapp = (
    <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="secondary" className="w-full sm:w-auto">
      WhatsApp
    </ButtonAnchor>
  );

  let card: React.ReactNode;
  if (r.paidAt && (r.status === "held" || r.status === "completed") && r.holdsUntil) {
    card = (
      <div className="surface-card !border-green-500/30 p-7 md:p-10">
        <p className="kicker">Deposit received</p>
        <h1 className="mt-3 text-display-3">Thank you, {r.buyerName.split(" ")[0]}. The {car} is held for you.</h1>
        <p className="mt-5 text-text-secondary">
          We received <strong className="figures text-text-primary">{formatNaira(paid)}</strong>. The car is yours to collect until{" "}
          <strong className="text-text-primary">{longDate(r.holdsUntil)}</strong>. Your reference is{" "}
          <strong className="figures text-text-primary">{reference}</strong>.
        </p>
        <ol className="mt-6 grid gap-2 text-text-secondary">
          <li>1. The team calls you to agree how you pay the rest: bank transfer, or at the showroom.</li>
          <li>2. You collect the car with your ID. Bring your mechanic if you like.</li>
          <li>3. Change your mind, and the deposit comes back less 18%: {formatNaira(refundFor(paid).refundMinor)}.</li>
        </ol>
        {r.buyerEmail && <p className="mt-4 text-sm text-text-muted">A receipt is on its way to {r.buyerEmail}.</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" arrow className="w-full sm:w-auto">
            Continue on WhatsApp with your reference
          </ButtonAnchor>
          {slug && (
            <ButtonLink href={`/vehicles/${slug}`} variant="secondary" className="w-full sm:w-auto">
              Back to the car
            </ButtonLink>
          )}
        </div>
      </div>
    );
  } else if (outcome === "mismatch" || short) {
    card = (
      <Card kicker="We need a moment" title="The amount we received is different from the deposit you chose.">
        <p className="mt-5 text-text-secondary">
          Nothing is lost: we have your <strong className="figures text-text-primary">{formatNaira(paid)}</strong>. The team has been told and will call you on{" "}
          {r.buyerPhone} to sort it out. Your reference is <strong className="figures text-text-primary">{reference}</strong>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">{whatsapp}</div>
      </Card>
    );
  } else if (outcome === "late" || (r.paidAt && r.status === "cancelled")) {
    card = (
      <Card kicker="Payment received" title="We have your money. The team will call you.">
        <p className="mt-5 text-text-secondary">
          Your payment of <strong className="figures text-text-primary">{formatNaira(paid)}</strong> arrived after your attempt had closed, and the {car} is
          no longer free. A person on the team calls you on {r.buyerPhone} to hold another car for you, or refund you. Your reference is{" "}
          <strong className="figures text-text-primary">{reference}</strong>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">{whatsapp}</div>
      </Card>
    );
  } else if (outcome === "in_flight" || outcome === "error") {
    card = (
      <Card kicker="One moment" title={outcome === "in_flight" ? "Your payment is on its way." : "We could not check the payment yet."}>
        <p className="mt-5 text-text-secondary">
          {outcome === "in_flight"
            ? "A bank transfer can take a few minutes to arrive. The car is held the moment it does, and you get a receipt."
            : "If you paid, it is safe: Paystack tells us directly and the car is held the moment it does."}{" "}
          Your reference is <strong className="figures text-text-primary">{reference}</strong>. Check again in a minute, or tell us on WhatsApp.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/reserve/done?reference=${encodeURIComponent(reference)}`}>Check again</ButtonLink>
          {whatsapp}
        </div>
      </Card>
    );
  } else if (r.status === "expired" && r.paidAt && r.holdsUntil) {
    card = (
      <Card kicker="Hold ran out" title={`Your hold on the ${car} ended on ${longDate(r.holdsUntil)}.`}>
        <p className="mt-5 text-text-secondary">
          Your deposit of <strong className="figures text-text-primary">{formatNaira(paid)}</strong> is with us. The team calls you to agree what happens next:
          the car again if it is still free, another car, or a refund less 18%. Your reference is <strong className="figures text-text-primary">{reference}</strong>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">{whatsapp}</div>
      </Card>
    );
  } else if (r.status === "refunded") {
    card = (
      <Card kicker="Refunded" title="Your deposit was sent back.">
        <p className="mt-5 text-text-secondary">
          {r.refundMinor !== null ? <>{formatNaira(r.refundMinor)} was sent back to you, less the 18% charge. </> : null}
          Your reference is <strong className="figures text-text-primary">{reference}</strong>. A refund reaches your account in three to ten working days.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">{whatsapp}</div>
      </Card>
    );
  } else {
    card = (
      <Card kicker="Not paid yet" title="The payment did not go through.">
        <p className="mt-5 text-text-secondary">
          Nothing was taken. Try again, or pay by bank transfer with the team. Call{" "}
          <a href={`tel:${site.phones[0].e164}`} className="figures font-semibold text-text-primary">
            {site.phones[0].display}
          </a>{" "}
          if you would rather a person took you through it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {slug && <ButtonLink href={`/reserve/${slug}`}>Try again</ButtonLink>}
          {whatsapp}
        </div>
      </Card>
    );
  }

  return <article className="mx-auto max-w-3xl px-5 pt-10 pb-20 md:px-10 md:pt-16">{card}</article>;
}
