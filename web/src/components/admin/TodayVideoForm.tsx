"use client";

import { useActionState } from "react";
import { setTodayVideo } from "@/lib/actions/audience";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-green-500";

/**
 * Today's video from the park: paste the link, add one line, save. One form,
 * quick enough to do from a phone at the park every day.
 */
export function TodayVideoForm({ current }: { current: { url: string; line: string; label: string } | null }) {
  const [state, action, pending] = useActionState(setTodayVideo, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Link to the video</span>
        <input
          name="url"
          type="url"
          inputMode="url"
          defaultValue={current?.url ?? ""}
          placeholder="https://www.facebook.com/… or TikTok, YouTube, Instagram"
          maxLength={500}
          className={control}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-text-secondary">One line from Ccristian Dee (optional)</span>
        <input name="line" defaultValue={current?.line ?? ""} placeholder="e.g. Two new Hummer buses came in today. Come and see them." maxLength={140} className={control} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center bg-green-500 px-5 text-sm font-semibold text-[#090E0A] transition-colors hover:bg-green-400 disabled:opacity-60"
        >
          {pending ? "Saving…" : current ? "Replace today's video" : "Put it on the homepage"}
        </button>
        {current && (
          <button
            type="submit"
            name="clear"
            value="1"
            disabled={pending}
            className="inline-flex min-h-11 items-center border border-border-default px-4 text-sm text-text-secondary hover:text-text-primary disabled:opacity-60"
          >
            Take it off
          </button>
        )}
        {current && <span className="text-xs text-text-muted">Showing now as “{current.label}”.</span>}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && state.outcome && <p className="text-sm text-success">{state.outcome}</p>}
    </form>
  );
}
