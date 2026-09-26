"use client";

import { useActionState } from "react";
import { submitFleetRequest } from "@/lib/actions/leads";
import { FLEET_QUANTITIES, FLEET_TIMEFRAMES, FLEET_VEHICLES } from "@/lib/fleet";
import { Button } from "@/components/ui/Button";
import { Confirmation, FieldError, fieldClass, Label, SpamGuard } from "./shared";

/**
 * A procurement brief, not a chat: organisation, what, how many, when and
 * where — enough for Sabicars to come back with a proper quotation.
 */
export function FleetForm({ whatsappBase }: { whatsappBase: string }) {
  const [state, action, pending] = useActionState(submitFleetRequest, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};
  const chosen = new Set((v.vehicles ?? "").split(",").filter(Boolean));
  // React re-applies a changed defaultValue to inputs, but not to a <select>:
  // after the automatic form reset a select falls back to its first option.
  // Keying each select on its returned value remounts it with the right one.
  // (Not the whole form: that would restart the anti-spam timer, and a quick
  // corrected resubmission would be discarded as a bot.)

  if (state?.ok) {
    return (
      <Confirmation
        name={state.name}
        reference={state.reference}
        body="Sabicars will contact you to confirm the specification and prepare a quotation."
        whatsappHref={`${whatsappBase}?text=${encodeURIComponent(`Hello Sabicars, I just sent a fleet request through your website (reference ${state.reference}).`)}`}
      />
    );
  }

  return (
    <form action={action} className="grid gap-8" noValidate>
      <SpamGuard />
      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2 sm:col-span-2">
          <Label>Organisation</Label>
          <input name="organisation" autoComplete="organization" required defaultValue={v.organisation} placeholder="Company, ministry, agency or school" className={fieldClass} />
          <FieldError message={err.organisation} />
        </label>
        <label className="grid gap-2">
          <Label>Your name</Label>
          <input name="name" autoComplete="name" required defaultValue={v.name} className={fieldClass} />
          <FieldError message={err.name} />
        </label>
        <label className="grid gap-2">
          <Label>Your role (optional)</Label>
          <input name="role" autoComplete="organization-title" defaultValue={v.role} placeholder="e.g. Procurement officer" className={fieldClass} />
        </label>
        <label className="grid gap-2">
          <Label>Phone number</Label>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={v.phone} className={`figures ${fieldClass}`} />
          <FieldError message={err.phone} />
        </label>
        <label className="grid gap-2">
          <Label>Email (optional)</Label>
          <input name="email" type="email" autoComplete="email" defaultValue={v.email} className={fieldClass} />
          <FieldError message={err.email} />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium text-text-secondary">Which vehicles?</legend>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {FLEET_VEHICLES.map((type) => (
            <label key={type} className="inline-flex min-h-11 items-center gap-3 text-text-secondary">
              <input type="checkbox" name="vehicles" value={type} defaultChecked={chosen.has(type)} className="size-4 accent-[var(--gold-500)]" />
              {type}
            </label>
          ))}
        </div>
        <FieldError message={err.vehicles} />
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <Label>Roughly how many?</Label>
          <select key={`q-${v.quantity ?? ""}`} name="quantity" defaultValue={v.quantity ?? ""} className={fieldClass}>
            <option value="" disabled>
              Choose…
            </option>
            {FLEET_QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <FieldError message={err.quantity} />
        </label>
        <label className="grid gap-2">
          <Label>When do you need them?</Label>
          <select key={`t-${v.timeframe ?? ""}`} name="timeframe" defaultValue={v.timeframe ?? ""} className={fieldClass}>
            <option value="" disabled>
              Choose…
            </option>
            {FLEET_TIMEFRAMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <FieldError message={err.timeframe} />
        </label>
        <label className="grid gap-2">
          <Label>Deliver to (optional)</Label>
          <input name="deliverTo" defaultValue={v.deliverTo} placeholder="City or state" className={fieldClass} />
        </label>
        <label className="grid gap-2">
          <Label>Budget (optional)</Label>
          <input name="budget" defaultValue={v.budget} placeholder="Total or per vehicle" className={fieldClass} />
        </label>
      </div>

      <label className="grid gap-2">
        <Label>Anything else we should know? (optional)</Label>
        <textarea name="notes" rows={4} defaultValue={v.notes} placeholder="Specification, colours, seating, documentation your organisation needs…" className={`${fieldClass} py-3 leading-relaxed`} />
      </label>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : "Request a quotation"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your details are used only to prepare and discuss this quotation.</p>
      </div>
    </form>
  );
}
