#!/usr/bin/env node
/**
 * The rules of a "Chat with seller" room, proved. A buyer in a silent room
 * leaves; Sabi answering over a salesperson mid-sentence is worse. Both are
 * decided by lib/assistant/seller.ts, and this is where it is held to it.
 *
 * Run: npm run test:seller
 */

import { CHAT_ALERT_EVERY_MINUTES, sabiMayAnswer, SELLER_WAIT_SECONDS, sellerWaitSeconds, shouldAlertStaff, staffPresent, waitingLine } from "../src/lib/assistant/seller";

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
const plus = (d: Date, seconds: number) => new Date(d.getTime() + seconds * 1000);

// 2026-10-19 is a Monday: open 08:00–19:00.
const monday11 = lagos("2026-10-19T11:00");
const monday23 = lagos("2026-10-19T23:00");

console.log("\nHow long a buyer waits for a person");
eq("during opening hours, the typical wait", sellerWaitSeconds(monday11), SELLER_WAIT_SECONDS);
eq("after closing, no wait at all", sellerWaitSeconds(monday23), 0);
eq("the buyer is told the showroom is closed", waitingLine(0).includes("closed"), true);
eq("or that the team has been told", waitingLine(75).startsWith("Sent to the team"), true);

console.log("\nWhen Sabi may answer");
eq("not while nothing is waiting", sabiMayAnswer({ awaitingSince: null, lastStaffAt: null }, monday11), false);
eq("not ten seconds in, during opening hours", sabiMayAnswer({ awaitingSince: monday11, lastStaffAt: null }, plus(monday11, 10)), false);
eq("yes once the wait has passed", sabiMayAnswer({ awaitingSince: monday11, lastStaffAt: null }, plus(monday11, SELLER_WAIT_SECONDS)), true);
eq("yes a few seconds early (clocks differ)", sabiMayAnswer({ awaitingSince: monday11, lastStaffAt: null }, plus(monday11, SELLER_WAIT_SECONDS - 4)), true);
eq("not a person's answer away: staff replied after the message", sabiMayAnswer({ awaitingSince: monday11, lastStaffAt: plus(monday11, 30) }, plus(monday11, 120)), false);
eq("a staff reply from before the message does not count", sabiMayAnswer({ awaitingSince: monday11, lastStaffAt: plus(monday11, -60) }, plus(monday11, 120)), true);
eq("after closing, at once", sabiMayAnswer({ awaitingSince: monday23, lastStaffAt: null }, plus(monday23, 1)), true);
eq("the wait is the one that applied when the message was sent, not now", sabiMayAnswer({ awaitingSince: lagos("2026-10-19T18:59:30"), lastStaffAt: null }, lagos("2026-10-19T19:00:10")), false);

console.log("\nA person in the room");
eq("present a minute after writing", staffPresent(monday11, plus(monday11, 60)), true);
eq("gone after ten minutes", staffPresent(monday11, plus(monday11, 10 * 60)), false);
eq("never present if they never wrote", staffPresent(null, monday11), false);

console.log("\nPinging staff phones");
eq("the first message pings", shouldAlertStaff(null, monday11), true);
eq("a second line a minute later does not", shouldAlertStaff(monday11, plus(monday11, 60)), false);
eq(`after ${CHAT_ALERT_EVERY_MINUTES} minutes it pings again`, shouldAlertStaff(monday11, plus(monday11, CHAT_ALERT_EVERY_MINUTES * 60)), true);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
