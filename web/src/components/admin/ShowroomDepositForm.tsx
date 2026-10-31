"use client";

import { useActionState, useState } from "react";
import { addShowroomDeposit } from "@/lib/actions/reservations-admin";
import { fieldClass } from "@/components/forms/field";

/**
 * A deposit taken at the showroom, recorded: the car is then held for that
 * buyer on the site too, so nobody else can reserve it online.
 */
export function ShowroomDepositForm({ vehicles }: { vehicles: { id: string; title: string; price: string }[] }) {
  // A new key gives a fresh form after one is recorded, so a second deposit needs no reload.
  const [round, setRound] = useState(0);
  return <DepositForm key={round} vehicles={vehicles} onAnother={() => setRound((n) => n + 1)} />;
}

function DepositForm({ vehicles, onAnother }: { vehicles: { id: string; title: string; price: string }[]; onAnother: () => void }) {
  const [state, action, pending] = useActionState(addShowroomDeposit, null);
  if (state?.ok) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-500/30 bg-green-500/[0.06] px-4 py-3 text-sm text-text-primary">
        Recorded. The car is held for the buyer.
        <button type="button" onClick={onAnother} className="inline-flex min-h-9 items-center rounded-full border border-border-default px-3 text-xs font-semibold text-text-secondary hover:border-border-strong">
          Record another
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-text-secondary">Car</span>
        <select name="vehicleId" required className={fieldClass} defaultValue="">
          <option value="" disabled>
            Choose the car
          </option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} · {v.price}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Buyer&rsquo;s name</span>
        <input name="name" required maxLength={120} className={fieldClass} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Phone number</span>
        <input name="phone" type="tel" inputMode="tel" required maxLength={40} className={`figures ${fieldClass}`} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Email (optional)</span>
        <input name="email" type="email" maxLength={200} className={fieldClass} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Deposit, in naira</span>
        <input name="amount" type="number" inputMode="numeric" min={1} step={1} required placeholder="500000" className={`figures ${fieldClass}`} />
      </label>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="text-sm font-medium text-text-secondary">Paid by</legend>
        <div className="flex flex-wrap gap-5 text-sm text-text-secondary">
          {(["cash", "pos", "bank"] as const).map((c, i) => (
            <label key={c} className="inline-flex min-h-10 items-center gap-2">
              <input type="radio" name="channel" value={c} defaultChecked={i === 0} className="size-4 accent-[var(--green-500)]" />
              {c === "cash" ? "Cash" : c === "pos" ? "POS" : "Bank transfer"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-text-secondary">Note (optional)</span>
        <input name="note" maxLength={500} className={fieldClass} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--orange-400),var(--orange-500))] px-6 font-semibold text-[#090E0A] disabled:opacity-60"
        >
          {pending ? "Recording…" : "Record the deposit"}
        </button>
      </div>
    </form>
  );
}
