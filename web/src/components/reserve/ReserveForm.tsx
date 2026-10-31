"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { fieldClass as field } from "@/components/forms/field";
import { PrivacyLink, SpamGuard } from "@/components/forms/shared";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { startReservation } from "@/lib/actions/reserve";
import { formatNaira } from "@/lib/money";
import { holdLabel } from "@/lib/reservations";
import { whatsappLink } from "@/lib/site";

export interface ChoiceView {
  amountMinor: number;
  label: string;
  holdDays: number;
  /** Paid on Paystack now; otherwise a bank transfer arranged with the team. */
  online: boolean;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

/**
 * Pick a deposit, give your details, pay. The amount decides the hold (a
 * week, or a month at 40% and above); the policy is read from
 * lib/reservations.ts on the server, so the page and the checkout agree.
 * An amount Paystack cannot take in one payment goes to the team instead.
 */
export function ReserveForm({ slug, title, choices }: { slug: string; title: string; choices: ChoiceView[] }) {
  const [state, action, pending] = useActionState(startReservation, null);
  const [chosen, setChosen] = useState(choices[0]?.amountMinor ?? 0);
  const choice = choices.find((c) => c.amountMinor === chosen) ?? choices[0];

  // Paid online: the browser goes to Paystack's page.
  useEffect(() => {
    if (state?.ok && state.url) window.location.assign(state.url);
  }, [state]);

  if (state?.ok && state.arranged) {
    return (
      <div role="status" className="surface-card !border-green-500/30 p-7 md:p-9">
        <p className="kicker">Reservation requested</p>
        <h3 className="mt-3 text-display-3">We will send you the account details.</h3>
        <p className="mt-4 text-text-secondary">
          Your reference is <strong className="figures text-text-primary">{state.reference}</strong>. A person on the team calls you with the
          Sabicars account details. The {title} is held for you once the money lands.
        </p>
        <ButtonAnchor href={whatsappLink(`Hello Sabicars, I want to reserve the ${title} (reference ${state.reference}).`)} target="_blank" rel="noopener noreferrer" variant="secondary" arrow className="mt-8 w-full sm:w-auto">
          Continue on WhatsApp with your reference
        </ButtonAnchor>
      </div>
    );
  }

  if (state?.ok && state.url) {
    return (
      <p role="status" className="surface-card p-7 text-text-secondary md:p-9">
        Taking you to the payment page…{" "}
        <a href={state.url} className="font-semibold text-green-300 underline-offset-4 hover:underline">
          Tap here if it does not open.
        </a>
      </p>
    );
  }

  return (
    <form action={action} className="surface-card grid gap-7 p-5 md:p-8" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {/* The amount sent is the one chosen in state: a form reset after a refused send cannot change it behind the button's back. */}
      <input type="hidden" name="amount" value={chosen} />
      <SpamGuard />

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-base font-semibold text-text-primary">How much do you want to put down?</legend>
        {choices.map((c) => (
          <label
            key={c.amountMinor}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
              c.amountMinor === chosen ? "border-green-400 bg-green-500/[0.08]" : "border-border-default hover:border-border-strong"
            }`}
          >
            <input type="radio" name="choice" value={c.amountMinor} checked={c.amountMinor === chosen} onChange={() => setChosen(c.amountMinor)} className="mt-1 size-4 accent-[var(--green-500)]" />
            <span className="grid gap-0.5">
              <span className="figures text-lg font-semibold text-text-primary">{formatNaira(c.amountMinor)}</span>
              <span className="text-sm text-text-secondary">
                {c.label}. Holds the car for {holdLabel(c.holdDays)}.
              </span>
              {!c.online && <span className="text-xs text-text-muted">Paid by bank transfer, arranged with the team.</span>}
            </span>
          </label>
        ))}
        <FieldError message={state?.fieldErrors?.amount} />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Your name</span>
          <input name="name" autoComplete="name" required maxLength={120} defaultValue={state?.values?.name} className={field} />
          <FieldError message={state?.fieldErrors?.name} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={40} placeholder="0803 123 4567" defaultValue={state?.values?.phone} className={`figures ${field}`} />
          <FieldError message={state?.fieldErrors?.phone} />
        </label>
        <label className="grid gap-2 sm:col-span-2">
          <span className="text-sm font-medium text-text-secondary">Email, for your receipt</span>
          <input name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={state?.values?.email} className={field} />
          <FieldError message={state?.fieldErrors?.email} />
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" disabled={pending || !choice} className="w-full sm:w-auto">
          {pending ? "One moment…" : choice?.online ? `Pay ${formatNaira(choice.amountMinor)} now` : "Reserve with the team"}
        </Button>
        <p className="mt-4 flex items-start gap-2 text-xs text-text-muted">
          <Lock aria-hidden size={14} className="mt-0.5 shrink-0" />
          <span>
            {choice?.online ? "Paid on Paystack by card or bank transfer. We never see your card." : "The team sends you the Sabicars account details."}{" "}
            Refunds cost 18% of the deposit. <PrivacyLink />
          </span>
        </p>
        <p className="mt-3 text-sm text-text-secondary">
          Want to see it first?{" "}
          <Link href={`/vehicles/${slug}#book-viewing`} className="font-semibold text-green-300 underline-offset-4 hover:underline">
            Book a viewing
          </Link>
          . Nothing is paid until you decide.
        </p>
      </div>
    </form>
  );
}
