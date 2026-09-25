"use client";

import { startTransition, useActionState, useRef } from "react";
import { createConsignor } from "@/lib/actions/vehicles";
import { Button } from "@/components/ui/Button";

const input =
  "min-h-12 w-full border border-border-strong bg-surface-0 px-4 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold-500";

export function ConsignorForm() {
  const [state, dispatch, pending] = useActionState(createConsignor, null);
  const form = useRef<HTMLFormElement>(null);
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          await dispatch(data);
        });
      }}
      className="grid gap-5 sm:grid-cols-2"
      noValidate
    >
      <label className="grid gap-2 sm:col-span-2">
        <span className="eyebrow !text-text-secondary">Name</span>
        <input name="name" required placeholder="e.g. the truck importer’s company name" className={input} />
        {err("name") && <span className="text-sm text-danger">{err("name")}</span>}
      </label>
      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Phone</span>
        <input name="phone" type="tel" className={`figures ${input}`} />
      </label>
      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Email</span>
        <input name="email" type="email" className={input} />
        {err("email") && <span className="text-sm text-danger">{err("email")}</span>}
      </label>
      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Country</span>
        <input name="country" placeholder="e.g. Japan" className={input} />
      </label>
      <label className="grid gap-2">
        <span className="eyebrow !text-text-secondary">Sabicars’ commission (%)</span>
        <input name="commissionPercent" inputMode="decimal" placeholder="Leave empty if agreed per vehicle" className={`figures ${input}`} />
        {err("commissionPercent") && <span className="text-sm text-danger">{err("commissionPercent")}</span>}
      </label>
      <label className="grid gap-2 sm:col-span-2">
        <span className="eyebrow !text-text-secondary">Notes</span>
        <textarea name="notes" rows={3} placeholder="Terms, contacts, anything the team should know" className={`${input} py-3`} />
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add consignor"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state?.error ? <span className="text-danger">{state.error}</span> : state?.ok ? <span className="text-success">Added.</span> : null}
        </p>
      </div>
    </form>
  );
}
