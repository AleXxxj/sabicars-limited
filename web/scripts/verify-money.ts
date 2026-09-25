#!/usr/bin/env node
/**
 * Money assertions. Every figure a customer or partner is shown — a price, a
 * 40% deposit, a commission — comes through these functions, so they are
 * checked on every build.
 *
 * Run: npm run test:money
 */

import { add, formatNaira, fromMajor, money, percentOf, subtract } from "../src/lib/money";

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
function throws(label: string, fn: () => unknown) {
  try {
    fn();
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m  did not throw`);
  } catch {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  }
}

const prado = fromMajor(38_000_000, "NGN");

console.log("\nStorage");
eq("₦38,000,000 is 3.8bn kobo", prado.minor, 3_800_000_000);
eq("still exact beyond 32 bits", prado.minor > 2 ** 31, true);
throws("refuses a fractional kobo amount", () => money(1.5, "NGN"));

console.log("\nThe 40% Drive Plan");
const deposit = percentOf(prado, 4000);
eq("40% of ₦38m", formatNaira(deposit.minor), "₦15,200,000");
eq("deposit + balance = price, to the kobo", add(deposit, subtract(prado, deposit)).minor, prado.minor);
const awkward = money(3_333_333_333, "NGN");
const d2 = percentOf(awkward, 4000);
eq("40% of an awkward price rounds to a whole kobo", Number.isInteger(d2.minor), true);
eq("…and still sums back exactly", d2.minor + subtract(awkward, d2).minor, awkward.minor);

console.log("\nReferral commission");
eq("1.5% of ₦10m", formatNaira(percentOf(fromMajor(10_000_000, "NGN"), 150).minor), "₦150,000");
eq("1.5% of ₦50m fleet order", formatNaira(percentOf(fromMajor(50_000_000, "NGN"), 150).minor), "₦750,000");
throws("refuses a fractional basis-point rate", () => percentOf(prado, 1.5));

console.log("\nSafety");
throws("refuses adding naira to dollars", () => add(prado, money(100, "USD")));

console.log("\nDisplay");
eq("formats a price", formatNaira(prado.minor), "₦38,000,000");
eq("formats compactly for dense grids", formatNaira(prado.minor, { compact: true }), "₦38M");

console.log(`\n${passed} passed, ${failed} failed.` + (failed ? "  \x1b[31mMONEY NOT VERIFIED\x1b[0m\n" : "  \x1b[32mMoney verified.\x1b[0m\n"));
process.exit(failed ? 1 : 0);
