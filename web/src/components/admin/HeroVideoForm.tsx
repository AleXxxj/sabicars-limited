"use client";

import { useActionState } from "react";
import { setHeroVideo } from "@/lib/actions/audience";
import { HERO_VIDEO_SECONDS } from "@/lib/hero-video";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-green-500";

/**
 * The homepage hero video: paste a YouTube link or a video file link, say for
 * how many seconds it plays (20 if left as it is), save. It plays once over
 * the photo slideshow, muted, then the slideshow returns; it stops when the
 * visitor scrolls past it. On a slow or data-saving connection it waits for
 * the visitor to tap "Watch video".
 */
export function HeroVideoForm({ current, seconds }: { current: string | null; seconds: number }) {
  const [state, action, pending] = useActionState(setHeroVideo, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Link to the video</span>
        <input
          name="url"
          type="url"
          inputMode="url"
          defaultValue={current ?? ""}
          placeholder="https://youtu.be/… or https://res.cloudinary.com/…/video.mp4"
          maxLength={500}
          className={control}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Play it for</span>
        <span className="flex items-center gap-2">
          <input
            name="seconds"
            type="number"
            inputMode="numeric"
            min={HERO_VIDEO_SECONDS.min}
            max={HERO_VIDEO_SECONDS.max}
            step={1}
            defaultValue={seconds}
            className={`${control} !w-24`}
          />
          <span className="text-sm text-text-secondary">seconds</span>
        </span>
        <span className="text-xs text-text-muted">
          Then the photos come back. {HERO_VIDEO_SECONDS.min} to {HERO_VIDEO_SECONDS.max} seconds; a shorter video stops at its own end.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center bg-green-500 px-5 text-sm font-semibold text-[#090E0A] transition-colors hover:bg-green-400 disabled:opacity-60"
        >
          {pending ? "Saving…" : current ? "Replace the video" : "Put it on the homepage"}
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
        {current && (
          <span className="text-xs text-text-muted">
            On the homepage now.{" "}
            {/* On a slow or data-saving connection (Chrome counts many Lagos connections as slow) the video waits for
                the visitor's "Watch video"; this link shows it starting by itself, whatever the connection. */}
            <a href="/?video" target="_blank" rel="noopener" className="font-semibold text-green-300 underline underline-offset-2 hover:text-green-200">
              See it play
            </a>
          </span>
        )}
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
