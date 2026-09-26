"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldClass, SpamGuard } from "@/components/forms/shared";
import { subscribe } from "@/lib/actions/subscribe";

export const SUBSCRIBED_KEY = "sabicars:subscribed";

/** Email in, and done. The promise it makes is the whole pitch: new arrivals, weekly, nothing else. */
export function SubscribeForm({ source, onDone }: { source: "prompt" | "footer" | "article" | "page"; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof subscribe>> | null, fd: FormData) => {
    const r = await subscribe(prev, fd);
    if (r.ok) {
      try {
        localStorage.setItem(SUBSCRIBED_KEY, "1");
      } catch {}
      onDone?.();
    }
    return r;
  }, null);

  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-3 text-sm text-text-secondary">
        <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-gold-300" />
        <span>
          {state.already ? (
            <>
              <span className="text-text-primary">{state.email}</span> is already on the list.
            </>
          ) : (
            <>
              You are on the list. The week&rsquo;s new arrivals reach <span className="text-text-primary">{state.email}</span> every
              Friday.
            </>
          )}
        </span>
      </p>
    );
  }

  return (
    <form action={action} className="relative grid gap-2" noValidate>
      <SpamGuard />
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your email address</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Your email address"
            className={fieldClass}
          />
        </label>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Adding…" : "Subscribe"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <p className="text-xs text-text-muted">New arrivals every Friday. One click to unsubscribe, any time.</p>
    </form>
  );
}
