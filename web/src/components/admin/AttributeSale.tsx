"use client";

import { startTransition, useActionState } from "react";
import { attributeSaleAction } from "@/lib/actions/payouts";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-green-500 disabled:opacity-60";
const quiet = "min-h-11 shrink-0 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50";

/**
 * "Did a partner bring this buyer?" A showroom sale attributed, by a manager,
 * to the partner whose code the buyer gave. One commission per vehicle; the
 * ledger refuses a second, and a partner buying for themselves.
 */
export function AttributeSale({ vehicleId }: { vehicleId: string }) {
  const [state, dispatch, pending] = useActionState(attributeSaleAction, null);
  const codeError = state?.fieldErrors?.code;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => dispatch(data));
      }}
      noValidate
      className="grid gap-2"
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <p className="text-xs leading-relaxed text-text-muted">
        First check the buyer is not the partner themselves: a partner’s own purchase earns the partner price, not a commission.
      </p>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Partner code</span>
        <div className="flex gap-2">
          <input
            name="code"
            required
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ADA7K3"
            aria-invalid={Boolean(codeError)}
            disabled={pending}
            className={`figures uppercase ${control}`}
          />
          <button type="submit" disabled={pending} className={quiet}>
            {pending ? "Checking…" : "Attribute"}
          </button>
        </div>
      </label>
      <p aria-live="polite" className="text-xs">
        {state?.ok ? (
          <span className="text-success">{state.message ?? "Recorded."}</span>
        ) : state?.error ? (
          <span className="text-danger">{codeError ?? state.error}</span>
        ) : (
          <span className="text-text-muted">The partner earns 1.5% of what it sold for, paid after the 48-hour cooling-off.</span>
        )}
      </p>
    </form>
  );
}
