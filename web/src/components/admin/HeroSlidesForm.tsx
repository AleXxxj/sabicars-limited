"use client";

import { useActionState } from "react";
import { setHeroSlides } from "@/lib/actions/audience";
import { HERO_SLIDE_KEYS, HERO_SLIDE_NAMES, type HeroPickSlugs } from "@/lib/hero-slides";

const control =
  "min-h-11 w-full border border-border-default bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-green-500";

/**
 * Which car stands on which slide of the homepage hero: one list per slide,
 * each naming the words a visitor reads there, so the choice is made knowing
 * what the car will stand under. "Choose by itself" leaves a slide to the
 * cars ticked "Use in the homepage hero". The server refuses a car the
 * slide's words would not be true of, and says why.
 */
export function HeroSlidesForm({ current, cars }: { current: HeroPickSlugs; cars: { slug: string; label: string }[] }) {
  const [state, action, pending] = useActionState(setHeroSlides, null);

  return (
    <form action={action} className="grid gap-4">
      {HERO_SLIDE_KEYS.map((key, i) => {
        // A pick that is no longer on the list (unlisted since) shows as "Choose by itself": that is what the homepage does with it.
        const value = cars.some((c) => c.slug === current[key]) ? current[key] : "";
        return (
          <label key={key} className="grid gap-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {i + 1}. {HERO_SLIDE_NAMES[key].name} <span className="font-normal text-text-muted">· says “{HERO_SLIDE_NAMES[key].says}”</span>
            </span>
            {/* Keyed by the saved value, so the list shows what was saved after a save. */}
            <select key={value} name={key} defaultValue={value} className={control}>
              <option value="">Choose by itself</option>
              {cars.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center bg-green-500 px-5 text-sm font-semibold text-[#090E0A] transition-colors hover:bg-green-400 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save the homepage cars"}
        </button>
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
