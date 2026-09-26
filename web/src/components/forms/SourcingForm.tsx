"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSourcingRequest } from "@/lib/actions/leads";
import { BUDGET_OPTIONS, PAYMENT_OPTIONS, YEAR_OPTIONS } from "@/lib/sourcing";
import { Button } from "@/components/ui/Button";
import { VehicleImage } from "@/components/VehicleImage";
import { Confirmation, FieldError, fieldClass, Label, SpamGuard } from "./shared";

const REPLY_BY = [
  ["whatsapp", "WhatsApp"],
  ["phone", "A phone call"],
  ["email", "Email"],
] as const;

/**
 * The Sourcing Desk's intake. Starts with the car, not the person — what they
 * want is why they are here — and may arrive pre-filled from the homepage.
 */
export function SourcingForm({ whatsappBase, initial }: { whatsappBase: string; initial: Record<string, string | undefined> }) {
  const [state, action, pending] = useActionState(submitSourcingRequest, null);
  const v: Record<string, string | undefined> = state?.values ?? initial;
  const err = state?.fieldErrors ?? {};

  if (state?.ok) {
    const matches = state.matches ?? [];
    return (
      <div className="grid gap-6">
        <Confirmation
          name={state.name}
          reference={state.reference}
          body="Your request is on the desk. When a vehicle that matches arrives, you will be told straight away."
          whatsappHref={`${whatsappBase}?text=${encodeURIComponent(`Hello Sabicars, I put a request on the Sourcing Desk (reference ${state.reference}).`)}`}
        />
        {matches.length > 0 && (
          <div className="border border-border-default bg-surface-1 p-6 md:p-8">
            <p className="eyebrow">Already in the showroom</p>
            <p className="mt-3 text-text-secondary">
              {matches.length === 1 ? "One vehicle in stock matches" : `${matches.length} vehicles in stock match`} what you asked for:
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {matches.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="group flex gap-4">
                    <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden bg-surface-2">
                      {m.coverUrl && <VehicleImage src={m.coverUrl} alt="" fill sizes="112px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-primary group-hover:text-accent-text">{m.title}</p>
                      <p className="figures mt-1 text-sm text-text-secondary">{m.price}</p>
                      {m.deposit && <p className="figures text-xs text-text-muted">{m.deposit} deposit on the Drive Plan</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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

      <fieldset className="grid gap-6">
        <legend className="eyebrow mb-6">The vehicle</legend>
        <label className="grid gap-2">
          <Label>What are you looking for?</Label>
          <input
            name="want"
            required
            defaultValue={v.want}
            placeholder="e.g. Toyota Highlander, Hiace bus, Lexus RX 350"
            className={fieldClass}
          />
          <FieldError message={err.want} />
        </label>
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="grid gap-2">
            <Label>Year</Label>
            <select key={`y-${v.yearFrom ?? ""}`} name="yearFrom" defaultValue={v.yearFrom ?? ""} className={fieldClass}>
              <option value="">Any year</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y} or newer
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <Label>Budget for the vehicle</Label>
            <select key={`b-${v.budget ?? ""}`} name="budget" defaultValue={v.budget ?? ""} className={fieldClass}>
              <option value="">Not sure yet</option>
              {BUDGET_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="eyebrow !text-text-secondary">How would you pay?</span>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
            {PAYMENT_OPTIONS.map((p) => (
              <label key={p.value} className="inline-flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="payment"
                  value={p.value}
                  defaultChecked={(v.payment ?? "undecided") === p.value}
                  className="size-4 accent-[var(--gold-500)]"
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="border-t border-border-subtle pt-8">
        <fieldset className="grid gap-6">
          <legend className="eyebrow mb-6">Where to reach you</legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="grid gap-2">
              <Label>Your name</Label>
              <input name="name" autoComplete="name" required defaultValue={v.name} className={fieldClass} />
              <FieldError message={err.name} />
            </label>
            <label className="grid gap-2">
              <Label>Phone number</Label>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="0803 123 4567"
                defaultValue={v.phone}
                className={`figures ${fieldClass}`}
              />
              <FieldError message={err.phone} />
            </label>
          </div>
          <label className="grid gap-2">
            <Label>Email (optional)</Label>
            <input name="email" type="email" autoComplete="email" defaultValue={v.email} className={fieldClass} />
            <FieldError message={err.email} />
          </label>
          <div>
            <span className="eyebrow !text-text-secondary">Tell me by</span>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
              {REPLY_BY.map(([value, label]) => (
                <label key={value} className="inline-flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name="preferredContact"
                    value={value}
                    defaultChecked={(v.preferredContact ?? "whatsapp") === value}
                    className="size-4 accent-[var(--gold-500)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="grid gap-2">
            <Label>Anything else? (optional)</Label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={v.notes}
              placeholder="Colour, mileage, a particular trim…"
              className={`${fieldClass} py-3 leading-relaxed`}
            />
          </label>
        </fieldset>
      </div>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Put it on the desk"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your details are used only to tell you about vehicles that match this request.</p>
      </div>
    </form>
  );
}
