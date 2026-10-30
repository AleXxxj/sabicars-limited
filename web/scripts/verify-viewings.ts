#!/usr/bin/env node
/**
 * Viewing-slot assertions. A buyer who books a time the showroom cannot keep
 * arrives to a locked gate, so every rule the booking form and the server
 * share is proved here.
 *
 * Run: npm run test:viewings
 */

import { BOOKING_DAYS, bookableDays, calendarFileUrl, foldLines, googleCalendarUrl, isBookableSlot, SLOT_CAPACITY, slotLabel, viewingCalendar } from "../src/lib/viewings";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}  = ${String(actual)}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m  expected ${String(expected)}, got ${String(actual)}`);
  }
}

/** A moment in Lagos time (UTC+1). */
const lagos = (iso: string) => new Date(`${iso}+01:00`);

// 2026-10-19 is a Monday; 2026-10-24 a Saturday.
const monday9 = lagos("2026-10-19T09:00");

console.log("\nWhich times can be booked");
eq("Monday 11:00, two hours ahead", isBookableSlot(lagos("2026-10-19T11:00"), monday9), true);
eq("Monday 10:00, only one hour ahead", isBookableSlot(lagos("2026-10-19T10:00"), monday9), false);
eq("Monday 18:00, the last weekday slot (closes 19:00)", isBookableSlot(lagos("2026-10-19T18:00"), monday9), true);
eq("Monday 19:00, closing time", isBookableSlot(lagos("2026-10-19T19:00"), monday9), false);
eq("Monday 11:30, not on the hour", isBookableSlot(lagos("2026-10-19T11:30"), monday9), false);
eq("Saturday 08:00, before weekend opening (9:00)", isBookableSlot(lagos("2026-10-24T08:00"), monday9), false);
eq("Saturday 09:00, weekend opening", isBookableSlot(lagos("2026-10-24T09:00"), monday9), true);
eq("Saturday 17:00, the last weekend slot (closes 18:00)", isBookableSlot(lagos("2026-10-24T17:00"), monday9), true);
eq("Saturday 18:00, weekend closing", isBookableSlot(lagos("2026-10-24T18:00"), monday9), false);
eq("eight days ahead, beyond the window", isBookableSlot(lagos("2026-10-27T10:00"), monday9), false);
eq("in the past", isBookableSlot(lagos("2026-10-18T10:00"), monday9), false);
eq("an unreadable time", isBookableSlot(new Date("not a date"), monday9), false);

console.log("\nThe days offered");
const days = bookableDays(monday9);
eq("the first day offered is today", days[0]?.key, "2026-10-19");
eq("today starts at 11:00 (two hours' notice)", days[0]?.slots[0]?.label, "11:00");
eq("today ends at 18:00", days[0]?.slots.at(-1)?.label, "18:00");
eq("Saturday has nine slots (9:00 to 17:00)", days.find((d) => d.key === "2026-10-24")?.slots.length, 9);
eq("a weekday has eleven slots (8:00 to 18:00)", days.find((d) => d.key === "2026-10-20")?.slots.length, 11);
eq("no day beyond the window", days.every((d) => d.key <= "2026-10-26"), true);
eq(`the window is ${BOOKING_DAYS} days`, days.at(-1)?.key, "2026-10-26");

const full = lagos("2026-10-20T10:00").toISOString();
const withFull = bookableDays(monday9, { [full]: SLOT_CAPACITY });
eq("a full slot is not offered", withFull.find((d) => d.key === "2026-10-20")?.slots.some((s) => s.startsAt === full), false);
const withOne = bookableDays(monday9, { [full]: SLOT_CAPACITY - 1 });
eq("a slot with room is still offered", withOne.find((d) => d.key === "2026-10-20")?.slots.some((s) => s.startsAt === full), true);
const late = bookableDays(lagos("2026-10-19T17:30"));
eq("after 17:00 nothing is left today", late[0]?.key, "2026-10-20");

console.log("\nWords and files");
eq("how a booking is written", slotLabel(lagos("2026-10-24T10:00")), "Saturday 24 October, 10:00");
const ics = viewingCalendar(lagos("2026-10-24T10:00"), "2013 Toyota Hiace Hummer 1", "Amazing Grace Shopping Complex, Km 16, Igando, Lagos", "SC-4E7A2D");
eq("the calendar event starts at 9:00 UTC (10:00 Lagos)", /DTSTART:20261024T090000Z/.test(ics), true);
eq("and lasts an hour", /DTEND:20261024T100000Z/.test(ics), true);
eq("commas in the address are escaped", /LOCATION:Amazing Grace Shopping Complex\\, Km 16\\, Igando\\, Lagos/.test(ics), true);
eq("lines end with CRLF, as calendars require", ics.includes("\r\nEND:VEVENT\r\n"), true);
eq("no line is longer than 75 octets (long ones are folded)", ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75), true);
eq("a folded line continues after a single space", /\r\n [^\r\n]/.test(ics), true);
const unfolded = ics.replace(/\r\n /g, "");
eq("unfolding gives the address back whole", /LOCATION:Amazing Grace Shopping Complex\\, Km 16\\, Igando\\, Lagos\r\n/.test(unfolded), true);
eq("a naira sign is never split across a fold", foldLines([`SUMMARY:${"₦".repeat(40)}`]).join("").replace(/\r\n /g, "").includes("₦".repeat(40)), true);
eq("the calendar file has a real address (an iPhone ignores data: links)", calendarFileUrl("SC-4E7A2D"), "/api/viewings/SC-4E7A2D/calendar.ics");
const gcal = new URL(googleCalendarUrl(lagos("2026-10-24T10:00"), "2013 Toyota Hiace Hummer 1", "Amazing Grace Shopping Complex, Km 16, Igando, Lagos", "SC-4E7A2D"));
eq("the Google Calendar link opens the event template", gcal.searchParams.get("action"), "TEMPLATE");
eq("with the same hour, in UTC", gcal.searchParams.get("dates"), "20261024T090000Z/20261024T100000Z");
eq("the same name", gcal.searchParams.get("text"), "Viewing: 2013 Toyota Hiace Hummer 1");
eq("and the reference in the notes", gcal.searchParams.get("details")?.includes("SC-4E7A2D"), true);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
