"use client";

import { useActionState, useTransition } from "react";
import { markMatchSent, markPriceDropSent, updateRequest } from "@/lib/actions/requests";

const STATUSES = [
  ["open", "To review"],
  ["sourcing", "Serious — sourcing"],
  ["matched", "Matched"],
  ["fulfilled", "Bought"],
  ["closed", "Closed"],
] as const;

const control = "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-gold-500";

/** Staff's verdict on a request: its status and a note on the buyer. */
export function RequestControls({ requestId, status, staffNote }: { requestId: string; status: string; staffNote: string | null }) {
  const [state, action, pending] = useActionState(updateRequest, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Status</span>
        <select name="status" defaultValue={status} className={control}>
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Note on the buyer</span>
        <textarea name="staffNote" rows={2} defaultValue={staffNote ?? ""} placeholder="How serious? What have we tried?" className={`${control} py-2`} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="min-h-11 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok && !pending && <span className="text-xs text-success">Saved</span>}
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

/**
 * For a match no automatic channel could deliver: opens WhatsApp with the
 * message already written, and records that a person sent it.
 */
export function NotifyOnWhatsApp({ matchId, watchId, href }: { matchId?: string; watchId?: string; href: string }) {
  const [pending, start] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        start(async () => {
          if (matchId) await markMatchSent(matchId);
          if (watchId) await markPriceDropSent(watchId);
        })
      }
      aria-disabled={pending}
      className="inline-flex min-h-10 items-center bg-cta px-4 text-xs font-semibold text-cta-fg hover:bg-cta-hover"
    >
      {pending ? "Recording…" : "Send on WhatsApp"}
    </a>
  );
}
