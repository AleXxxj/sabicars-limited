import { showroomHours } from "@/lib/showroom-hours";
import { site } from "@/lib/site";

/**
 * Viewing slots: what a buyer can book, straight from the showroom's hours.
 *
 * One hour each, on the hour, from opening until an hour before closing, up to
 * a week ahead and at least two hours from now, so someone can get the car
 * ready. Two viewings can share an hour: there is more than one salesperson.
 * Plain functions, used by the booking form in the browser and checked again
 * by the server before a booking is saved.
 */
export const SLOT_MINUTES = 60;
export const SLOT_CAPACITY = 2;
export const MIN_NOTICE_HOURS = 2;
export const BOOKING_DAYS = 7;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface Slot {
  /** ISO time, the value the form sends. */
  startsAt: string;
  /** "10:00", Lagos time. */
  label: string;
}

export interface SlotDay {
  /** "2026-10-21", Lagos date. */
  key: string;
  /** "Tue 21 Oct". */
  label: string;
  slots: Slot[];
}

const timeLabel = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
const dayKey = (at: Date) => at.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const dayLabel = (at: Date) => at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });

/** "Saturday 25 October, 10:00": how a booked viewing is written to the buyer and to staff. */
export function slotLabel(at: Date): string {
  return `${at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" })}, ${timeLabel(at)}`;
}

/** Every slot start in the Lagos day containing `at`, whether or not it is still bookable. */
function slotsOfDay(at: Date): Date[] {
  const { opens, closes } = showroomHours(at);
  const out: Date[] = [];
  for (let t = opens.getTime(); t + SLOT_MINUTES * 60_000 <= closes.getTime(); t += SLOT_MINUTES * 60_000) out.push(new Date(t));
  return out;
}

/**
 * True when `at` is a slot a buyer may book now: a real slot start, inside
 * opening hours, far enough ahead, and within the booking window.
 */
export function isBookableSlot(at: Date, now = new Date()): boolean {
  if (Number.isNaN(at.getTime())) return false;
  if (at.getTime() < now.getTime() + MIN_NOTICE_HOURS * HOUR) return false;
  if (at.getTime() > now.getTime() + BOOKING_DAYS * DAY) return false;
  return slotsOfDay(at).some((s) => s.getTime() === at.getTime());
}

/**
 * The days a buyer can choose from, each with its open slots. `taken` counts
 * bookings per slot start (ISO); a slot at capacity is left out, and so is a
 * day with nothing left.
 */
export function bookableDays(now: Date, taken: Record<string, number> = {}): SlotDay[] {
  const days: SlotDay[] = [];
  for (let i = 0; i <= BOOKING_DAYS; i++) {
    const day = new Date(now.getTime() + i * DAY);
    const slots = slotsOfDay(day)
      .filter((s) => isBookableSlot(s, now) && (taken[s.toISOString()] ?? 0) < SLOT_CAPACITY)
      .map((s) => ({ startsAt: s.toISOString(), label: timeLabel(s) }));
    if (slots.length) days.push({ key: dayKey(day), label: dayLabel(day), slots });
  }
  return days;
}

/** A calendar file for the buyer's phone: the viewing, at the showroom, an hour long. */
export function viewingCalendar(at: Date, title: string, location: string, reference: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(at.getTime() + SLOT_MINUTES * 60_000);
  // RFC 5545 needs commas, semicolons and backslashes escaped in text.
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sabicars//Viewings//EN",
    "BEGIN:VEVENT",
    `UID:${reference}@${site.domain}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(`Viewing: ${title}`)}`,
    `LOCATION:${text(location)}`,
    `DESCRIPTION:${text(`Sabicars viewing, reference ${reference}. Bring your mechanic if you like.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
