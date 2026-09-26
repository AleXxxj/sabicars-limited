"use client";

import { useActionState, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, SpamGuard } from "@/components/forms/shared";
import { submitBuyerReview, submitReview } from "@/lib/actions/reviews";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Set once this browser has left a review, so it is not asked again. */
export const REVIEWED_KEY = "sabicars:reviewed";

/** Five stars as a radio group: arrow keys move between them, and each says what it means. */
function StarInput({ defaultValue, error }: { defaultValue?: number; error?: string }) {
  const [value, setValue] = useState(defaultValue ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-text-secondary">Your rating</legend>
      <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className="cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                required
                defaultChecked={value === n}
                onChange={() => setValue(n)}
                className="sr-only"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"} — {WORDS[n]}
              </span>
              <Star
                aria-hidden
                size={32}
                strokeWidth={1.4}
                className={`transition-colors duration-[var(--duration-fast)] ${n <= shown ? "fill-gold-400 text-gold-400" : "fill-transparent text-white/30"}`}
              />
            </label>
          ))}
        </div>
        <span aria-hidden className="text-sm text-text-secondary">
          {WORDS[shown]}
        </span>
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

/**
 * A review, from a visitor or — through the private link sent with a
 * purchase — a verified buyer. Either way it waits for a person to read it.
 */
export function ReviewForm({ token, defaultName, onDone }: { token?: string; defaultName?: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(token ? submitBuyerReview : submitReview, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};
  useEffect(() => {
    if (!state?.ok) return;
    try {
      localStorage.setItem(REVIEWED_KEY, "1");
    } catch {}
  }, [state]);

  if (state?.ok) {
    return (
      <div role="status" className="py-4">
        <p className="kicker">Received</p>
        <p className="mt-3 font-display text-[1.9rem] leading-tight">Thank you.</p>
        <p className="mt-3 text-text-secondary">
          Your review appears on the site once the team has read it. Every review is read by a person first — that is what keeps the page
          worth reading.
        </p>
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone} className="mt-6">
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6" noValidate>
      {token ? <input type="hidden" name="token" value={token} /> : <SpamGuard />}
      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <StarInput key={v.rating ?? "new"} defaultValue={v.rating ? Number(v.rating) : undefined} error={err.rating} />
      <label className="grid gap-2">
        <Label>Your review</Label>
        <textarea
          name="message"
          rows={4}
          required
          maxLength={1500}
          defaultValue={v.message}
          placeholder={token ? "How was buying from Sabicars? How is the vehicle now?" : "What was your experience with Sabicars?"}
          className={`${fieldClass} py-3 leading-relaxed`}
        />
        <FieldError message={err.message} />
      </label>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <Label>Your name</Label>
          <input name="name" autoComplete="name" required maxLength={80} defaultValue={v.name ?? defaultName} className={fieldClass} />
          <FieldError message={err.name} />
        </label>
        <label className="grid gap-2">
          <Label>Where you are (optional)</Label>
          <input name="location" maxLength={80} placeholder="e.g. Ikeja, Lagos" defaultValue={v.location} className={fieldClass} />
        </label>
      </div>
      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : "Post my review"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your review, name and location appear on the site once the team has read it.</p>
      </div>
    </form>
  );
}
