"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { startDrivePlan } from "@/lib/actions/leads";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import { FieldError, SpamGuard } from "@/components/forms/shared";

/**
 * The Drive Plan's next step on a vehicle's page.
 *
 * Listed on Autochek: two fields, then straight on to this car's Autochek
 * listing, where Autochek profiles the buyer and the loan terms are already
 * set. Sabicars keeps the record on the way through — for the follow-up, and
 * so a referring partner keeps their commission. "Go straight to Autochek"
 * stays available: nobody is made to fill a form to reach their loan.
 *
 * Not listed yet: the same two fields become a request to list it.
 */
export function DrivePlanApply({ vehicleId, autochekUrl }: { vehicleId: string; autochekUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(startDrivePlan, null);
  const v = state?.values ?? {};

  const destination = state?.ok ? state.autochekUrl : null;
  useEffect(() => {
    if (destination) window.location.assign(destination);
  }, [destination]);

  if (state?.ok && destination) {
    return <p role="status" className="mt-5 text-sm text-text-secondary">Taking you to Autochek…</p>;
  }
  if (state?.ok) {
    return (
      <div role="status" className="mt-5 rounded-xl border border-gold-500/30 bg-gold-500/10 p-4 text-sm leading-relaxed text-text-primary">
        Thank you{state.name ? `, ${state.name}` : ""}. Sabicars will put this vehicle on its Autochek store and send you the application
        link{state.reference ? <> — your reference is <strong className="figures">{state.reference}</strong></> : null}.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-5 grid gap-3">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} arrow className="w-full">
          {autochekUrl ? "Apply for the 60% on Autochek" : "Apply for the Drive Plan"}
        </Button>
        {autochekUrl && (
          <a href={autochekUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text-primary">
            or go straight to Autochek <ArrowUpRight aria-hidden size={14} />
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 grid gap-3" noValidate>
      <SpamGuard />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <p className="text-sm text-text-secondary">
        {autochekUrl
          ? "Your name and number, so Sabicars can follow your application. Then Autochek takes you through the rest."
          : "This vehicle is not on Autochek yet. Leave your name and number and Sabicars will list it and send you the link."}
      </p>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Your name</span>
        <input name="name" autoComplete="name" required defaultValue={v.name} className={fieldClass} />
        <FieldError message={state?.fieldErrors?.name} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Phone number</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={v.phone} className={`figures ${fieldClass}`} />
        <FieldError message={state?.fieldErrors?.phone} />
      </label>
      <Button type="submit" disabled={pending} arrow className="w-full">
        {pending ? "One moment…" : autochekUrl ? "Continue to Autochek" : "Send my request"}
      </Button>
    </form>
  );
}
