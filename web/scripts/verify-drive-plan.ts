#!/usr/bin/env node
/**
 * Drive Plan assertions. The deposit a buyer is shown depends on the car's
 * model year, and a wrong tier is a promise Autochek will not honour, so the
 * rules are proved on every build.
 *
 * Run: npm run test:drive-plan
 */

import {
  DEFAULT_ESTIMATE_MONTHS,
  DRIVE_PLAN,
  ESTIMATE_MONTHS,
  depositBpsFor,
  depositMinorFor,
  depositPercentLabel,
  drivePlanTerms,
  monthlyAtCeilingMinor,
  reachMinorFor,
} from "../src/lib/drive-plan";
import { formatNaira } from "../src/lib/money";

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

console.log("\nWhich cars Autochek finances, and at what deposit");
eq("a 2010 car needs 40% down", depositBpsFor(2010), 4000);
eq("a 2024 car needs 40% down", depositBpsFor(2024), 4000);
eq("a 2009 car needs 50% down", depositBpsFor(2009), 5000);
eq("a 2008 car needs 50% down", depositBpsFor(2008), 5000);
eq("a 2007 car is not financed", depositBpsFor(2007), null);
eq("a 2000 truck is not financed", depositBpsFor(2000), null);
eq("a nonsense year is not financed", depositBpsFor(Number.NaN), null);
eq("the standard tier starts at 2010", DRIVE_PLAN.standardYear, 2010);
eq("the plan starts at 2008", DRIVE_PLAN.minYear, 2008);

console.log("\nThe labels a buyer sees");
eq("2015 reads 40%", depositPercentLabel(2015), "40%");
eq("2008 reads 50%", depositPercentLabel(2008), "50%");
eq("2005 has no label", depositPercentLabel(2005), null);
const t = drivePlanTerms(2009);
eq("2009: Autochek finances the other 50%", t.eligible && t.financedPercent, 50);
const s = drivePlanTerms(2013);
eq("2013: Autochek finances the other 60%", s.eligible && s.financedPercent, 60);

console.log("\nThe money");
eq("40% of ₦24,000,000 (a 2013 Hummer 1)", formatNaira(depositMinorFor(2_400_000_000, 2013)!), "₦9,600,000");
eq("50% of ₦14,500,000 (a 2006 Hiace) is not offered", depositMinorFor(1_450_000_000, 2006), null);
eq("50% of ₦8,500,000 (a 2009 car)", formatNaira(depositMinorFor(850_000_000, 2009)!), "₦4,250,000");
eq("no price, no deposit", depositMinorFor(null, 2015), null);
const awkward = 3_333_333_333; // ₦33,333,333.33
const d = depositMinorFor(awkward, 2012)!;
eq("40% of an awkward price rounds to whole naira", d, 1_333_333_300);
eq("…shown as ₦13,333,333 + ₦20,000,000", `${formatNaira(d)} + ${formatNaira(awkward - d)}`, "₦13,333,333 + ₦20,000,000");
const d50 = depositMinorFor(awkward, 2009)!;
eq("50% of an awkward price rounds to whole naira", d50, 1_666_666_700);
// ₦1,000,001 at 50% is ₦500,000.50: rounded to whole naira, so the formatted deposit and balance still add up to the price.
const odd = 100_000_100;
const dOdd = depositMinorFor(odd, 2009)!;
eq("50% of ₦1,000,001 is a whole naira", dOdd % 100, 0);
eq("…shown as ₦500,001", formatNaira(dOdd), "₦500,001");
eq("…and the shown balance is ₦500,000", formatNaira(odd - dOdd), "₦500,000");

console.log("\nWhat a deposit reaches (standard tier)");
eq("₦10m down reaches a ₦25m car", formatNaira(reachMinorFor(1_000_000_000)), "₦25,000,000");
eq("₦4m down reaches a ₦10m car", formatNaira(reachMinorFor(400_000_000)), "₦10,000,000");

console.log("\nWhat the plan publishes");
eq("statements: six months", DRIVE_PLAN.statementMonths, 6);
eq("rate ceiling: 30% a year", DRIVE_PLAN.maxAnnualRatePercent, 30);
eq("tenure from 6 months", DRIVE_PLAN.tenureMonths.min, 6);
eq("tenure to 48 months", DRIVE_PLAN.tenureMonths.max, 48);
eq("a buyer may put down up to 70%", DRIVE_PLAN.maxDepositBps, 7000);
eq("…which is more than either minimum", DRIVE_PLAN.maxDepositBps > DRIVE_PLAN.olderDepositBps, true);
// Autochek's published example must be an ordinary amortised loan at its own ceiling, or the site is quoting a number it cannot explain.
// (₦97,487.13 a month, which Autochek publishes to the naira.)
const { principalMinor, months, monthlyMinor } = DRIVE_PLAN.published.example;
eq("Autochek's example (₦1,000,000 over 12 months at the ceiling) amortises to its own figure", monthlyAtCeilingMinor(principalMinor, months), monthlyMinor);
eq("…shown as ₦97,487 a month", formatNaira(monthlyMinor), "₦97,487");
eq("processing fee example reads ₦20,000", formatNaira(DRIVE_PLAN.published.processingFeeMinor), "₦20,000");

console.log("\nThe monthly estimate a buyer sees (at the ceiling, never a quote)");
eq("the default term is the longest Autochek publishes", DEFAULT_ESTIMATE_MONTHS, DRIVE_PLAN.tenureMonths.max);
eq("every offered term is within Autochek's range", ESTIMATE_MONTHS.every((m) => m >= DRIVE_PLAN.tenureMonths.min && m <= DRIVE_PLAN.tenureMonths.max), true);
const hummerBalance = 2_400_000_000 - depositMinorFor(2_400_000_000, 2013)!; // 60% of ₦24,000,000
eq("60% of a ₦24m 2013 Hummer over 48 months", formatNaira(monthlyAtCeilingMinor(hummerBalance, 48)!), "₦518,486");
eq("…and over 12 months", formatNaira(monthlyAtCeilingMinor(hummerBalance, 12)!), "₦1,403,815");
const olderBalance = 2_000_000_000 - depositMinorFor(2_000_000_000, 2009)!; // 50% of ₦20,000,000
eq("50% of a ₦20m 2009 car over 48 months", formatNaira(monthlyAtCeilingMinor(olderBalance, 48)!), "₦360,060");
eq("the estimate is whole naira", monthlyAtCeilingMinor(hummerBalance, 36)! % 100, 0);
eq("a term Autochek does not publish gives no figure", monthlyAtCeilingMinor(hummerBalance, 60), null);
eq("nothing financed, no figure", monthlyAtCeilingMinor(0, 48), null);
eq("statements: an app counts without a commercial bank account", DRIVE_PLAN.statementAlternative, "a bank app such as OPay");

console.log(`\n${passed} passed, ${failed} failed.` + (failed ? "  \x1b[31mDRIVE PLAN NOT VERIFIED\x1b[0m\n" : "  \x1b[32mDrive Plan verified.\x1b[0m\n"));
process.exit(failed ? 1 : 0);
