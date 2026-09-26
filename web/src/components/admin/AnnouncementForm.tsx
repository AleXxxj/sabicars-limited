"use client";

import { useActionState, useEffect, useRef } from "react";
import { postAnnouncement } from "@/lib/actions/audience";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-gold-500";

/** Post an offer or news to the bell — and, if chosen, to phones and inboxes. */
export function AnnouncementForm({
  vehicles,
  subscribers,
  pushReady,
  emailReady,
}: {
  vehicles: { id: string; label: string }[];
  subscribers: number;
  pushReady: boolean;
  emailReady: boolean;
}) {
  const [state, action, pending] = useActionState(postAnnouncement, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={action}
      onSubmit={(e) => {
        const email = new FormData(e.currentTarget).get("email") === "on";
        if (
          email &&
          !window.confirm(`Email this to ${subscribers} ${subscribers === 1 ? "subscriber" : "subscribers"}? It cannot be unsent.`)
        )
          e.preventDefault();
      }}
      className="grid gap-4"
    >
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Headline</span>
        <input
          name="title"
          required
          maxLength={90}
          placeholder="e.g. This weekend only: free first service on every Hummer bus"
          className={control}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">Message</span>
        <textarea
          name="message"
          required
          rows={3}
          maxLength={1200}
          placeholder="What it is, until when, and what to do."
          className={`${control} py-2`}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs text-text-muted">About a vehicle (optional — it links there and uses its photo)</span>
        <select name="vehicleId" defaultValue="" className={control}>
          <option value="">No particular vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1 text-xs text-text-muted">Also send it</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="push"
            defaultChecked={pushReady}
            disabled={!pushReady}
            className="mt-1 size-4 accent-[var(--gold-500)]"
          />
          <span>
            As a phone alert to everyone who turned alerts on
            {!pushReady && <span className="block text-xs text-text-muted">Needs ONESIGNAL_REST_API_KEY on the server.</span>}
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="email" disabled={!emailReady} className="mt-1 size-4 accent-[var(--gold-500)]" />
          <span>
            By email to {subscribers} newsletter {subscribers === 1 ? "subscriber" : "subscribers"}
            {!emailReady && (
              <span className="block text-xs text-text-muted">Needs RESEND_API_KEY and RESEND_FROM_EMAIL on the server.</span>
            )}
          </span>
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 bg-cta px-5 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
        {state?.ok && !pending && <span className="text-xs text-success">{state.outcome}</span>}
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
