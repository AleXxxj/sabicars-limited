"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { payByPaystackAction, recordBankTransferAction, type PayoutActionResult } from "@/lib/actions/payouts";
import { formatNaira } from "@/lib/money";

/**
 * The two ways a commission is paid, each behind a second look at where the
 * money goes: a Paystack transfer from Sabicars' balance, or a transfer made
 * from the bank and recorded here. Both are final — a payout is the record
 * of money that has left — so neither fires on one tap.
 */

/** The commission and the account it is paid into, as the row on the Payouts page knows them. */
export interface PayoutTarget {
  commissionId: string;
  amountMinor: number;
  bankName: string;
  /** "••••••1234": the number is never shown in full here. */
  accountMasked: string;
  /** Whose account the bank says it is — or, when confirmed by hand, the partner's name. */
  holder: string;
}

const primary = "min-h-11 rounded-full bg-cta px-4 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50";
const quiet = "min-h-11 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50";
const control = "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-green-500 read-only:opacity-60";

const where = (t: PayoutTarget) => `${t.bankName} ${t.accountMasked} (${t.holder})`;

/** "YYYY-MM-DD" today in Lagos, for the date field's default and its ceiling. */
const todayLagos = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

const dateLabel = (ymd: string) =>
  new Date(`${ymd}T00:00:00+01:00`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** Sends the commission from Sabicars' Paystack balance, after confirming the account it goes to. */
export function PayViaPaystack({ target }: { target: PayoutTarget }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = () =>
    start(async () => {
      const r = await payByPaystackAction(target.commissionId);
      setResult(r.ok ? { ok: true, text: r.message ?? "Sent." } : { ok: false, text: r.error ?? "The transfer was not sent." });
      setAsking(false);
    });

  if (result?.ok)
    return (
      <p role="status" className="text-sm text-success">
        {result.text}
      </p>
    );

  return (
    <div className="grid gap-2">
      {asking ? (
        <div className="grid gap-3 border-l-2 border-green-500 pl-3">
          <p className="text-sm text-text-primary">
            Send {formatNaira(target.amountMinor)} to {where(target)}? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={pending} className={primary}>
              {pending ? "Sending…" : `Send ${formatNaira(target.amountMinor)}`}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={pending} className={quiet}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setAsking(true);
          }}
          className={primary}
        >
          Pay via Paystack
        </button>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-danger">
          {result.text}
        </p>
      )}
    </div>
  );
}

/**
 * Records a transfer made from the bank: its reference, the date, a note.
 * The details are read back once before they are saved, because saving marks
 * the commission paid.
 */
export function RecordBankTransfer({ target }: { target: PayoutTarget }) {
  const [state, dispatch, pending] = useActionState(recordBankTransferAction, null);
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // The read-back is tied to the result it was shown against: a new result
  // (an error from the server) takes the form back to its fields on its own.
  const [confirm, setConfirm] = useState<{ reference: string; paidOn: string; seen: PayoutActionResult | null } | null>(null);
  const confirming = confirm !== null && confirm.seen === state;
  const today = todayLagos();
  const err = (k: string) => state?.fieldErrors?.[k];

  if (state?.ok)
    return (
      <p role="status" className="text-sm text-success">
        {state.message ?? "Recorded."}
      </p>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={quiet}>
        Record a bank transfer
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (!confirming) {
          const reference = String(data.get("bankReference") ?? "").trim();
          const paidOn = String(data.get("paidOn") ?? "");
          if (reference.length < 4) return setLocalError("Enter the bank's reference or teller number — at least 4 characters.");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return setLocalError("Enter the date it was paid.");
          if (paidOn > today) return setLocalError("The payment date cannot be in the future.");
          setLocalError(null);
          setConfirm({ reference, paidOn, seen: state });
          return;
        }
        startTransition(() => dispatch(data));
      }}
      noValidate
      className="grid gap-3 border-l-2 border-border-strong pl-3"
    >
      <input type="hidden" name="commissionId" value={target.commissionId} />
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Bank reference or teller number</span>
        <input name="bankReference" required maxLength={80} readOnly={confirming} autoComplete="off" className={`figures ${control}`} />
        {err("bankReference") && <span className="text-xs text-danger">{err("bankReference")}</span>}
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Date paid</span>
        <input type="date" name="paidOn" required defaultValue={today} max={today} readOnly={confirming} className={`figures ${control}`} />
        {err("paidOn") && <span className="text-xs text-danger">{err("paidOn")}</span>}
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Note (optional)</span>
        <input name="note" maxLength={300} readOnly={confirming} placeholder="Who sent it, which account it left from…" className={control} />
        {err("note") && <span className="text-xs text-danger">{err("note")}</span>}
      </label>

      {confirming ? (
        <>
          <p className="text-sm text-text-primary">
            Record {formatNaira(target.amountMinor)} paid to {where(target)} on {dateLabel(confirm.paidOn)}, reference{" "}
            <span className="figures">{confirm.reference}</span>? This marks the commission paid and cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primary}>
              {pending ? "Recording…" : "Record it"}
            </button>
            <button type="button" onClick={() => setConfirm(null)} disabled={pending} className={quiet}>
              Go back
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary}>
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              setOpen(false);
            }}
            className={quiet}
          >
            Cancel
          </button>
        </div>
      )}
      {(localError || state?.error) && (
        <p role="alert" className="text-sm text-danger">
          {localError ?? state?.error}
        </p>
      )}
    </form>
  );
}
