/**
 * The showroom's opening hours as a clock the lead engine can run on.
 *
 * Response time is only fair while someone is there to respond: an enquiry
 * sent at 2am starts its clock when the showroom opens. The hours are the
 * published ones in `site.hours` — weekdays 8am–7pm, weekends 9am–6pm.
 */
import { site } from "@/lib/site";

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1 all year — Nigeria has no daylight saving.
const HOUR = 3600_000;

/** The opening and closing time of the Lagos day containing `at`. */
export function showroomHours(at = new Date()): { opens: Date; closes: Date } {
  const lagos = new Date(at.getTime() + LAGOS_OFFSET_MS);
  const day = lagos.getUTCDay(); // 0 = Sunday
  const hours = site.hours.find((h) => (h.weekdays as readonly number[]).includes(day));
  if (!hours) throw new Error(`site.hours does not cover day ${day}`);
  const { opens: open, closes: close } = hours;
  const midnight = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET_MS;
  return { opens: new Date(midnight + open * HOUR), closes: new Date(midnight + close * HOUR) };
}

export function isOpen(at = new Date()): boolean {
  const { opens, closes } = showroomHours(at);
  return at >= opens && at < closes;
}

/** When the response clock starts for a lead sent at `at`: then, if open; otherwise the next opening. */
export function clockStartsAt(at: Date): Date {
  const today = showroomHours(at);
  if (at < today.opens) return today.opens;
  if (at < today.closes) return at;
  return showroomHours(new Date(today.opens.getTime() + 24 * HOUR)).opens;
}

/** Minutes of showroom time between a lead arriving and its first reply. A reply before opening counts as instant. */
export function responseMinutes(createdAt: Date, firstResponseAt: Date): number {
  return Math.max(0, (firstResponseAt.getTime() - clockStartsAt(createdAt).getTime()) / 60_000);
}

/**
 * The reply promise a page may make, from the showroom minutes it really took
 * to answer recent enquiries — or null, when the record does not earn one.
 *
 * A tester on another marketplace messaged a seller and never heard back;
 * Sabicars can beat that visibly, but only with a claim its own numbers
 * back. So: at least 10 answered enquiries, and the promised minutes are the
 * slowest of the fastest four in five (the 80th percentile), rounded up to
 * five, and only when that is within an hour. "Most" is then literally true.
 */
export const PROMISE_MIN_ANSWERED = 10;
export const PROMISE_MAX_MINUTES = 60;
export function replyPromiseFrom(minutes: number[]): number | null {
  if (minutes.length < PROMISE_MIN_ANSWERED) return null;
  const sorted = [...minutes].sort((a, b) => a - b);
  const p80 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.8) - 1)];
  const promised = Math.max(5, Math.ceil(p80 / 5) * 5);
  return promised <= PROMISE_MAX_MINUTES ? promised : null;
}

/** "4 min", "1 h 20 min", "2 days" — how long, in the words staff would use. */
export function formatWait(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }
  const d = Math.round(m / (24 * 60));
  return `${d} day${d === 1 ? "" : "s"}`;
}
