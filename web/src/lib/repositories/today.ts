import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { videoSource, type VideoSource } from "@/lib/blog/video";
import { sabicarsDealerId } from "@/lib/leads";

/** The settings row that holds the day's video from the park: `{ url, line, at }`. */
export const TODAY_VIDEO_KEY = "today_video";

/** After this many days the video is no longer "today's": the homepage drops it rather than show a stale one. */
export const TODAY_VIDEO_MAX_DAYS = 14;

export interface TodayVideo {
  url: string;
  /** One line from the founder to go with it, or empty. */
  line: string;
  /** When staff set it. */
  at: Date;
  source: VideoSource;
  /** "Today's video", "Tuesday's video", "Last week's video". */
  label: string;
}

const lagosDay = (d: Date) => d.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });

/** How the homepage names the video by its age, on Lagos days. */
export function videoLabel(at: Date, now = new Date()): string {
  if (lagosDay(at) === lagosDay(now)) return "Today's video";
  const ageDays = (now.getTime() - at.getTime()) / 86_400_000;
  if (ageDays < 6.5) return `${at.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", weekday: "long" })}'s video`;
  return "Last week's video";
}

/** The day's video, when staff have set one in the last two weeks and the link is one the site can play. */
export async function todayVideo(now = new Date()): Promise<TodayVideo | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.dealerId, await sabicarsDealerId()), eq(settings.key, TODAY_VIDEO_KEY)))
    .limit(1);
  const v = row?.value as { url?: unknown; line?: unknown; at?: unknown } | null | undefined;
  if (!v || typeof v.url !== "string" || typeof v.at !== "string") return null;
  const at = new Date(v.at);
  const ageDays = (now.getTime() - at.getTime()) / 86_400_000;
  if (!(ageDays > -1 && ageDays <= TODAY_VIDEO_MAX_DAYS)) return null;
  const source = videoSource(v.url);
  if (!source) return null;
  return { url: v.url, line: typeof v.line === "string" ? v.line.trim() : "", at, source, label: videoLabel(at, now) };
}
