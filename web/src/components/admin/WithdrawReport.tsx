"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawInspection } from "@/lib/actions/inspections";

/** Takes a live report down, after a second tap: the car loses its Verified badge until a new report is published. */
export function WithdrawReport({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const r = await withdrawInspection(reportId);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not withdrawn. Try again.");
      setBusy(false);
    }
  }

  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-text-muted hover:text-danger">
        Withdraw
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="text-text-secondary">The car loses its Verified badge.</span>
      <button type="button" onClick={withdraw} disabled={busy} className="font-semibold text-danger disabled:opacity-50">
        {busy ? "Withdrawing…" : "Withdraw the report"}
      </button>
      <button type="button" onClick={() => setAsking(false)} disabled={busy} className="text-text-muted hover:text-text-primary">
        Keep it
      </button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}
