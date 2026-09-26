"use client";

import { useState, useTransition } from "react";
import { moderateReview } from "@/lib/actions/reviews";

/** Publish or hide. Anything genuine is published — including a critical review. */
export function ReviewControls({ reviewId, isApproved, reviewed }: { reviewId: string; isApproved: boolean; reviewed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (publish: boolean) =>
    start(async () => {
      const r = await moderateReview(reviewId, publish);
      setError(r.ok ? null : (r.error ?? "That did not save."));
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      {(!isApproved || !reviewed) && (
        <button
          type="button"
          onClick={() => run(true)}
          disabled={pending}
          className="min-h-11 bg-cta px-5 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Publish"}
        </button>
      )}
      {(isApproved || !reviewed) && (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={pending}
          className="min-h-11 border border-border-strong px-5 text-sm text-text-primary hover:border-text-primary disabled:opacity-50"
        >
          Hide
        </button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
