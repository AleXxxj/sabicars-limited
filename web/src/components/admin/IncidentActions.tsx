"use client";

import { useActionState } from "react";
import { resolveIncidentAction, type OpsActionResult } from "@/lib/actions/ops";

const quietButton = "min-h-11 border border-border-strong px-4 text-sm text-text-primary hover:border-text-primary disabled:opacity-50";

/**
 * "Resolve" on an open error. One tap: resolving is not final the way paying
 * is — the same error happening again reopens the same row — so it needs no
 * second look. The page re-renders with the error moved to the resolved list.
 */
export function ResolveIncident({ id }: { id: string }) {
  const [state, action, pending] = useActionState<OpsActionResult | null, FormData>(async () => resolveIncidentAction(id), null);

  if (state?.ok)
    return (
      <p role="status" className="text-sm text-success">
        Resolved.
      </p>
    );

  return (
    <form action={action} className="grid justify-items-start gap-2">
      <button type="submit" disabled={pending} className={quietButton}>
        {pending ? "Resolving…" : "Resolve"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
