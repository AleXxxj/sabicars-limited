#!/usr/bin/env node
/**
 * The owner's reservation policy, proved: ₦500,000 holds a car for a week,
 * 40% or more for a month, a refund costs 18% of the deposit, and nobody
 * reserves a car another buyer is holding. Money mistakes here are the ones
 * that end up in a dispute at the gate, so every rule is pinned.
 *
 * Run: npm run test:reservations
 */

import {
  depositChoices,
  holdDaysFor,
  holdsUntil,
  LONG_HOLD_DAYS,
  longHoldDepositMinor,
  MIN_DEPOSIT_MINOR,
  minimumDepositMinor,
  refundFor,
  SHORT_HOLD_DAYS,
  stillHolding,
} from "../src/lib/reservations";

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

const naira = (n: number) => n * 100;
const price14m = naira(14_000_000);

console.log("\nThe least deposit");
eq("₦500,000", MIN_DEPOSIT_MINOR, naira(500_000));
eq("on a ₦14m car", minimumDepositMinor(price14m), naira(500_000));
eq("on a ₦400,000 car, the whole price", minimumDepositMinor(naira(400_000)), naira(400_000));
eq("with no price known, still ₦500,000", minimumDepositMinor(null), naira(500_000));

console.log("\nHow long a deposit holds the car");
eq("₦500,000 on ₦14m: a week", holdDaysFor(naira(500_000), price14m), SHORT_HOLD_DAYS);
eq("₦5,599,999 on ₦14m (just under 40%): a week", holdDaysFor(naira(5_599_999), price14m), SHORT_HOLD_DAYS);
eq("₦5,600,000 on ₦14m (40%): a month", holdDaysFor(naira(5_600_000), price14m), LONG_HOLD_DAYS);
eq("the full ₦14m: a month", holdDaysFor(price14m, price14m), LONG_HOLD_DAYS);
eq("₦499,999: not allowed", holdDaysFor(naira(499_999), price14m), null);
eq("more than the price: not allowed", holdDaysFor(naira(14_000_001), price14m), null);
eq("a fraction of a naira: not allowed", holdDaysFor(naira(500_000) + 50, price14m), null);
eq("40% of ₦14m is ₦5,600,000", longHoldDepositMinor(price14m), naira(5_600_000));
eq("40% of ₦10,000,001 rounds up to a naira", longHoldDepositMinor(naira(10_000_001)), naira(4_000_001));
eq("a week from a Monday noon ends the next Monday noon", holdsUntil(new Date("2026-11-02T11:00:00Z"), 7).toISOString(), "2026-11-09T11:00:00.000Z");

console.log("\nRefunds");
eq("₦500,000 back: ₦410,000", refundFor(naira(500_000)).refundMinor, naira(410_000));
eq("and the charge is ₦90,000", refundFor(naira(500_000)).chargeMinor, naira(90_000));
eq("₦5,600,000 back: ₦4,592,000", refundFor(naira(5_600_000)).refundMinor, naira(4_592_000));
eq("odd amounts round the refund down to a naira", refundFor(naira(500_001)).refundMinor, naira(410_000));
eq("and the two halves still add up", refundFor(naira(500_001)).refundMinor + refundFor(naira(500_001)).chargeMinor, naira(500_001));

console.log("\nWhat the checkout offers");
const choices = depositChoices(price14m);
eq("three choices on a ₦14m car", choices.length, 3);
eq("the least first", choices[0]?.amountMinor, naira(500_000));
eq("40% second", choices[1]?.amountMinor, naira(5_600_000));
eq("the full price last", choices[2]?.amountMinor, price14m);
eq("the least holds a week", choices[0]?.holdDays, SHORT_HOLD_DAYS);
eq("40% holds a month", choices[1]?.holdDays, LONG_HOLD_DAYS);
const cheap = depositChoices(naira(1_000_000));
eq("a ₦1m car: 40% is under the least, so two choices", cheap.length, 2);
eq("its least is ₦500,000", cheap[0]?.amountMinor, naira(500_000));
eq("a ₦400,000 car: one choice, the whole price", depositChoices(naira(400_000)).length, 1);

console.log("\nWho is holding the car");
const now = new Date("2026-11-02T12:00:00Z");
eq("a paid hold until next week: holding", stillHolding({ status: "held", holdsUntil: new Date("2026-11-09T11:00:00Z"), createdAt: now }, now), true);
eq("a paid hold that ended: not holding", stillHolding({ status: "held", holdsUntil: new Date("2026-11-02T11:59:00Z"), createdAt: now }, now), false);
eq("an unpaid attempt 5 minutes old: holding", stillHolding({ status: "pending", holdsUntil: null, createdAt: new Date("2026-11-02T11:55:00Z") }, now), true);
eq("an unpaid attempt an hour old: not holding", stillHolding({ status: "pending", holdsUntil: null, createdAt: new Date("2026-11-02T11:00:00Z") }, now), false);
eq("a refunded one: not holding", stillHolding({ status: "refunded", holdsUntil: new Date("2026-12-01T00:00:00Z"), createdAt: now }, now), false);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
