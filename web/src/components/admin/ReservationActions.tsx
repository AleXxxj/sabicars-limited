"use client";

import { useState, useTransition } from "react";
import { completeReservationAction, endReservationAction } from "@/lib/actions/reservations-admin";

/**
 * What staff can do with one reservation: complete it (the buyer paid the
 * rest), cancel it, or refund the deposit less the charge. Each asks once
 * before it acts. A refund moves money, and cancelling a paid deposit keeps
 * it: both are a manager's call.
 */
export function ReservationActions({
  id,
  status,
  paid,
  manager,
  refundLabel,
}: {
  id: string;
  status: string;
  /** Money was received on this row. */
  paid: boolean;
  /** Owner or manager: may refund, and may cancel a paid deposit. */
  manager: boolean;
  /** "₦410,000 back" — the refund the policy gives, computed on the server. */
  refundLabel: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await work();
      if (!r.ok) setError(r.error ?? "That did not work.");
    });
  const button = "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-50";
  const live = status === "held" || status === "expired";
  const canCancel = status === "pending" || (live && (!paid || manager));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {live && paid && (
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm("The buyer has paid the rest and the car is theirs? Then record the sale on the car's page.") && run(() => completeReservationAction(id))}
          className={`${button} border-green-500/50 text-green-200 hover:bg-green-500/10`}
        >
          Completed
        </button>
      )}
      {(live || status === "cancelled") && paid && manager && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const note = prompt(`Refund the deposit less 18% (${refundLabel})? Add a note if you like.`, "");
            if (note !== null) run(() => endReservationAction(id, "refund", note));
          }}
          className={`${button} border-orange-400/50 text-orange-200 hover:bg-orange-500/10`}
        >
          Refund
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const note = prompt(
              paid
                ? "Cancel this reservation? The car goes back on offer and the deposit stays with Sabicars. To return it, use Refund instead. Add a note if you like."
                : "Cancel this attempt? The car goes back on offer. Add a note if you like.",
              "",
            );
            if (note !== null) run(() => endReservationAction(id, "cancel", note));
          }}
          className={`${button} border-border-default text-text-secondary hover:border-border-strong`}
        >
          Cancel
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
