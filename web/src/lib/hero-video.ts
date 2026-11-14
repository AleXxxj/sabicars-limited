/**
 * How long the homepage hero video plays before the slides come back.
 *
 * Pure, with no database and no React: the admin action, the reader and the
 * hero share these numbers, and scripts/verify-hero.ts proves them.
 *
 * The owner asked for this on 14 November 2026: "the video should only play
 * for 20 seconds and resume back to slide show, or make the duration editable
 * in the admin". So it is 20 seconds unless a manager sets another number in
 * Admin, Audience. It is counted in the video's own time, so a video that
 * stops to load on a slow connection still shows its full share; a video
 * shorter than the number ends at its own end.
 */
export const HERO_VIDEO_SECONDS = { default: 20, min: 5, max: 120 } as const;

/** The settings row that holds the number of seconds (set from Admin, Audience, beside the video's link). */
export const HERO_VIDEO_SECONDS_KEY = "hero_video_seconds";

/** A stored value read safely: a whole number of seconds within the limits; the default when there is none or it is not a number. */
export function readVideoSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return HERO_VIDEO_SECONDS.default;
  return Math.min(HERO_VIDEO_SECONDS.max, Math.max(HERO_VIDEO_SECONDS.min, Math.round(n)));
}

/**
 * What a manager typed in the seconds box: the number, or why it cannot be used. Left empty, it is the default.
 * Unlike readVideoSeconds, a number out of range is refused, not quietly changed: the manager should know.
 */
export function parseVideoSeconds(typed: string): { seconds: number } | { error: string } {
  const t = typed.trim();
  if (!t) return { seconds: HERO_VIDEO_SECONDS.default };
  if (!/^\d+$/.test(t)) return { error: "Type the seconds as a whole number, like 20." };
  const n = Number(t);
  if (n < HERO_VIDEO_SECONDS.min || n > HERO_VIDEO_SECONDS.max) {
    return { error: `Choose between ${HERO_VIDEO_SECONDS.min} and ${HERO_VIDEO_SECONDS.max} seconds.` };
  }
  return { seconds: n };
}
