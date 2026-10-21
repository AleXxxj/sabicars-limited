"use client";

import { useActionState, useState } from "react";
import { BadgeCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldClass, Label } from "@/components/forms/shared";
import { saveBankAccountByToken, type BankAccountFormResult } from "@/lib/actions/partner-account";

/** The registered account as the page shows it: the number itself never leaves the server. */
export interface CurrentAccount {
  bankName: string;
  bankCode: string;
  /** ••••••1234 */
  accountMasked: string;
  /** The name the bank holds, when it could be asked. */
  accountName: string | null;
  verified: boolean;
}

/**
 * The one bank account a partner is paid into, on their own page. Once an
 * account is saved it is shown masked, with "Change account" to enter a new
 * one — a change starts the verification again, which is the point.
 */
export function BankAccountForm({
  token,
  partnerName,
  banks,
  current,
}: {
  token: string;
  partnerName: string;
  banks: { code: string; name: string }[];
  current: CurrentAccount | null;
}) {
  const [state, action, pending] = useActionState(saveBankAccountByToken, null);
  // Whether the form is open follows the latest result — open until an account is saved, closed after — unless the
  // partner has pressed "Change account" or "Cancel" since that result arrived.
  const [override, setOverride] = useState<{ after: BankAccountFormResult | null; open: boolean } | null>(null);
  const implied = state ? !state.ok : !current;
  const showForm = override && override.after === state ? override.open : implied;
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  return (
    <div className="grid gap-6">
      {state?.ok && !showForm && (
        <p role="status" className="border-l-2 border-green-500 bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-primary">
          {state.accountName && (
            <>
              The bank holds this account in the name <strong>{state.accountName}</strong>.{" "}
            </>
          )}
          {state.verified ? "Verified — this is your account." : "Saved. Sabicars will confirm the account before your first payout."}
        </p>
      )}

      {!showForm && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {current ? (
            <div>
              <p className="text-text-primary">
                {current.bankName} · <span className="figures">{current.accountMasked}</span>
              </p>
              {current.accountName && <p className="mt-1 text-sm text-text-secondary">{current.accountName}</p>}
              <p className={`mt-2 inline-flex items-center gap-2 text-sm ${current.verified ? "text-green-300" : "text-text-muted"}`}>
                {current.verified ? (
                  <>
                    <BadgeCheck aria-hidden size={17} /> Verified — this is your account.
                  </>
                ) : (
                  <>
                    <Clock aria-hidden size={17} /> Not verified yet: Sabicars confirms it before your first payout.
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">Your account is saved.</p>
          )}
          <Button type="button" variant="secondary" onClick={() => setOverride({ after: state, open: true })}>
            Change account
          </Button>
        </div>
      )}

      {showForm && (
        <form action={action} className="grid gap-6" noValidate>
          <input type="hidden" name="token" value={token} />
          {state && !state.ok && state.error && (
            <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="grid gap-2">
              <Label>Bank</Label>
              <select key={`b-${v.bankCode ?? ""}`} name="bankCode" required defaultValue={v.bankCode ?? current?.bankCode ?? ""} className={fieldClass}>
                <option value="" disabled>
                  Choose your bank…
                </option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
              <FieldError message={err.bankCode} />
            </label>
            <label className="grid gap-2">
              <Label>Account number</Label>
              <input
                name="accountNumber"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                autoComplete="off"
                required
                placeholder="10 digits"
                defaultValue={v.accountNumber}
                className={`figures ${fieldClass}`}
              />
              <FieldError message={err.accountNumber} />
            </label>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            Must be in your own name — <strong className="text-text-primary">{partnerName}</strong> — or it cannot be paid into.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save account"}
            </Button>
            {current && (
              <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => setOverride({ after: state, open: false })}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
