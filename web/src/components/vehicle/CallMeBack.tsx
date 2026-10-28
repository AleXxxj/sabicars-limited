"use client";

import { useActionState, useState } from "react";
import { PhoneCall } from "lucide-react";
import { requestCallBack } from "@/lib/actions/enquiry";
import { Button } from "@/components/ui/Button";
import { fieldClass as field } from "@/components/forms/field";
import { PrivacyLink } from "@/components/forms/shared";

/**
 * One field: your number, and someone calls you. The shortest path to a person
 * on the page, for the buyer who will not type a message. It is saved as an
 * enquiry with a reference, like everything else, so the reply is on the
 * clock and on record.
 */
export function CallMeBack({ vehicleId, vehicleTitle, landingPath }: { vehicleId: string; vehicleTitle: string; landingPath: string }) {
  const [state, action, pending] = useActionState(requestCallBack, null);
  const [renderedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div role="status" className="surface-card !border-green-500/30 p-5 md:p-6">
        <p className="font-semibold text-text-primary">We will call {state.phone} shortly.</p>
        <p className="mt-2 text-sm text-text-secondary">
          About the {vehicleTitle}. Your reference is <span className="figures font-semibold text-text-primary">{state.reference}</span>. If we
          call outside opening hours, it will be first thing in the morning.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="surface-card p-5 md:p-6" noValidate>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="landingPath" value={landingPath} />
      <input type="hidden" name="renderedAt" value={renderedAt} />
      <div className="absolute -left-[9999px] top-auto" aria-hidden>
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor={`call-back-${vehicleId}`} className="flex items-center gap-2 font-semibold text-text-primary">
        <PhoneCall aria-hidden size={18} className="text-green-300" /> Just want a call? Leave your number.
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={`call-back-${vehicleId}`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state?.phone}
          placeholder="0803 123 4567"
          aria-invalid={Boolean(state?.error) || undefined}
          className={`${field} figures sm:flex-1`}
        />
        <Button type="submit" disabled={pending} className="sm:shrink-0">
          {pending ? "Sending…" : "Call me back"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <p className="mt-3 text-xs text-text-muted">
        We call about this car only. <PrivacyLink />
      </p>
    </form>
  );
}
