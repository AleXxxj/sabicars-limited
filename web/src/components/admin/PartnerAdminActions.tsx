"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/forms/shared";
import { confirmBankAccountAction, setPartnerStatusAction, voidCommissionAction, type ActionResult } from "@/lib/actions/partners-admin";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-green-500";
const quietButton = "min-h-11 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50";
const textButton = "text-sm text-text-muted hover:text-text-primary disabled:opacity-50";

/**
 * What a manager does to a partner, each behind a second tap: money and
 * people, so nothing here happens by accident. The server action makes the
 * change and the page re-renders with the result.
 */

/** "I have checked: this account is in the partner's own name." */
export function ConfirmAccount({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async () => confirmBankAccountAction(partnerId), null);

  if (state?.ok) return <p className="text-sm text-success">Confirmed. The account can now be paid.</p>;
  if (!asking)
    return (
      <Button type="button" variant="secondary" onClick={() => setAsking(true)}>
        Confirm the account
      </Button>
    );
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm text-text-secondary">
        Only confirm after checking, with the bank or the partner, that this account is in <span className="text-text-primary">{partnerName}</span>&rsquo;s own name. A
        confirmed account is where every payout to them goes.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Confirming…" : "Yes, it is in their name"}
        </Button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className={textButton}>
          Not yet
        </button>
      </div>
      <FieldError message={state?.error} />
    </form>
  );
}

/** Suspend (the link stops attributing, nothing is paid) or reactivate. */
export function PartnerStatusControl({ partnerId, status, partnerName }: { partnerId: string; status: "active" | "suspended"; partnerName: string }) {
  const [asking, setAsking] = useState(false);
  const next = status === "active" ? "suspended" : "active";
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async () => setPartnerStatusAction(partnerId, next), null);

  if (state?.ok) return <p className="text-sm text-success">{next === "suspended" ? "Suspended." : "Reactivated."}</p>;
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className={next === "suspended" ? "text-sm text-text-muted hover:text-danger" : quietButton}>
        {next === "suspended" ? "Suspend this partner" : "Reactivate this partner"}
      </button>
    );
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm text-text-secondary">
        {next === "suspended"
          ? `${partnerName}'s link stops bringing enquiries to their code, and nothing is paid to them while they are suspended. Commissions already on record stay on record.`
          : `${partnerName}'s link attributes buyers to them again, and commissions past their cooling-off can be paid.`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={next === "suspended" ? "text-sm font-semibold text-danger disabled:opacity-50" : quietButton}>
          {pending ? "Saving…" : next === "suspended" ? "Suspend them" : "Reactivate them"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className={textButton}>
          Keep as is
        </button>
      </div>
      <FieldError message={state?.error} />
    </form>
  );
}

/** Voids a pending commission, with a reason the partner reads on their own page. */
export function VoidCommission({ commissionId, amountLabel }: { commissionId: string; amountLabel: string }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => voidCommissionAction(commissionId, String(formData.get("reason") ?? "")),
    null,
  );

  if (state?.ok) return <span className="text-xs text-text-muted">Voided.</span>;
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-xs text-text-muted hover:text-danger">
        Void
      </button>
    );
  return (
    <form action={action} className="grid min-w-[14rem] gap-2">
      <label className="grid gap-1">
        <span className="text-xs text-text-muted">Why is the {amountLabel} not owed? The partner reads this.</span>
        <input name="reason" required minLength={3} maxLength={300} autoFocus placeholder="e.g. the sale fell through" className={control} />
      </label>
      <FieldError message={state?.fieldErrors?.reason ?? state?.error} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="text-sm font-semibold text-danger disabled:opacity-50">
          {pending ? "Voiding…" : "Void it"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className={textButton}>
          Keep it
        </button>
      </div>
    </form>
  );
}

/** Copies a link, falling back to a prompt where the clipboard is not available. */
export function CopyLink({ link, label = "Copy the link" }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        } catch {
          window.prompt("Copy the link:", link);
        }
      }}
      className={quietButton}
    >
      {copied ? "Link copied" : label}
    </button>
  );
}
