"use client";

import { useActionState } from "react";
import { BellRing } from "lucide-react";
import { watchVehicles } from "@/lib/actions/saved";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import { FieldError, SpamGuard } from "@/components/forms/shared";

const REPLY_BY = [
  ["whatsapp", "WhatsApp"],
  ["phone", "Call"],
  ["email", "Email"],
] as const;

/** "Tell me if the price drops" — for one car, or every car on the shortlist. */
export function WatchForm({ slugs, landingPath, compact = false }: { slugs: string[]; landingPath: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(watchVehicles, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-5 text-text-primary">
        <p className="flex items-center gap-2 font-semibold">
          <BellRing aria-hidden size={18} className="text-gold-300" /> You’re on the list{state.name ? `, ${state.name}` : ""}.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          If the price of {state.count === 1 ? "this car" : `any of these ${state.count} cars`} drops, you will be told straight away.
          {state.reference && state.reference !== "SC-RECEIVED" && (
            <>
              {" "}
              Your reference is <strong className="figures text-text-primary">{state.reference}</strong>.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <SpamGuard />
      <input type="hidden" name="slugs" value={slugs.join(",")} />
      <input type="hidden" name="landingPath" value={landingPath} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Your name</span>
          <input name="name" autoComplete="name" required defaultValue={v.name} className={fieldClass} />
          <FieldError message={err.name} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={v.phone} className={`figures ${fieldClass}`} />
          <FieldError message={err.phone} />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Email (optional — alerts arrive instantly by email)</span>
        <input name="email" type="email" autoComplete="email" defaultValue={v.email} className={fieldClass} />
        <FieldError message={err.email} />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
        <span className="font-medium">Tell me by</span>
        {REPLY_BY.map(([value, label]) => (
          <label key={value} className="inline-flex min-h-11 items-center gap-2">
            <input type="radio" name="preferredContact" value={value} defaultChecked={(v.preferredContact ?? "whatsapp") === value} className="size-4 accent-[var(--gold-500)]" />
            {label}
          </label>
        ))}
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        <BellRing aria-hidden size={18} /> {pending ? "Saving…" : "Alert me if the price drops"}
      </Button>
    </form>
  );
}
