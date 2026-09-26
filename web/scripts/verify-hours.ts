#!/usr/bin/env node
/**
 * Showroom-clock assertions. Response time and escalation both run on this
 * clock, so a staff member is never blamed — or a manager woken — for an
 * enquiry that arrived while the showroom was closed.
 *
 * Run: npm run test:hours
 */

import { clockStartsAt, formatWait, isOpen, responseMinutes, showroomHours } from "../src/lib/showroom-hours";

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

/** A moment in Lagos time (UTC+1), written the way staff would say it. */
const lagos = (iso: string) => new Date(`${iso}+01:00`);
const iso = (d: Date) => d.toISOString();

// 2026-09-28 is a Monday; 2026-10-03 a Saturday; 2026-10-04 a Sunday.
console.log("\nOpening hours (weekdays 8am–7pm, weekends 9am–6pm, Lagos time)");
eq("Monday opens at 8:00 Lagos", iso(showroomHours(lagos("2026-09-28T12:00")).opens), iso(lagos("2026-09-28T08:00")));
eq("Monday closes at 19:00 Lagos", iso(showroomHours(lagos("2026-09-28T12:00")).closes), iso(lagos("2026-09-28T19:00")));
eq("Saturday opens at 9:00", iso(showroomHours(lagos("2026-10-03T12:00")).opens), iso(lagos("2026-10-03T09:00")));
eq("Sunday closes at 18:00", iso(showroomHours(lagos("2026-10-04T12:00")).closes), iso(lagos("2026-10-04T18:00")));
eq(
  "00:30 Lagos is still that Lagos day (23:30 UTC the day before)",
  iso(showroomHours(lagos("2026-09-29T00:30")).opens),
  iso(lagos("2026-09-29T08:00")),
);
eq("open at 8:00 sharp", isOpen(lagos("2026-09-28T08:00")), true);
eq("closed at 7:59", isOpen(lagos("2026-09-28T07:59")), false);
eq("closed at 19:00 sharp", isOpen(lagos("2026-09-28T19:00")), false);
eq("closed at 8:30 on a Saturday", isOpen(lagos("2026-10-03T08:30")), false);

console.log("\nWhen the response clock starts");
eq("during hours: immediately", iso(clockStartsAt(lagos("2026-09-28T10:15"))), iso(lagos("2026-09-28T10:15")));
eq("before opening: at opening", iso(clockStartsAt(lagos("2026-09-28T06:40"))), iso(lagos("2026-09-28T08:00")));
eq("after closing: next morning", iso(clockStartsAt(lagos("2026-09-28T21:00"))), iso(lagos("2026-09-29T08:00")));
eq("Friday night: Saturday at 9", iso(clockStartsAt(lagos("2026-10-02T22:00"))), iso(lagos("2026-10-03T09:00")));
eq("Sunday night: Monday at 8", iso(clockStartsAt(lagos("2026-10-04T20:00"))), iso(lagos("2026-10-05T08:00")));

console.log("\nResponse minutes");
eq("answered 6 minutes after a 10:00 enquiry", responseMinutes(lagos("2026-09-28T10:00"), lagos("2026-09-28T10:06")), 6);
eq("2am enquiry answered at 8:20 took 20 showroom minutes", responseMinutes(lagos("2026-09-28T02:00"), lagos("2026-09-28T08:20")), 20);
eq("answered overnight, before opening, counts as instant", responseMinutes(lagos("2026-09-28T22:00"), lagos("2026-09-28T22:30")), 0);

console.log("\nWait labels");
eq("0.4 min", formatWait(0.4), "under a minute");
eq("14 min", formatWait(14), "14 min");
eq("90 min", formatWait(90), "1 h 30 min");
eq("120 min", formatWait(120), "2 h");
eq("3 days", formatWait(3 * 24 * 60), "3 days");

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
