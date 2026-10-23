#!/usr/bin/env node
/**
 * Commission ledger assertions. A wrong commission, a payout a day early or a
 * payout to the wrong name is money out of the business's hands, so the rules
 * are proved on every build.
 *
 * Run: npm run test:ledger
 */

import {
  approvalDecision,
  COOLING_OFF_HOURS,
  commissionFor,
  failureSentenceFor,
  isPayable,
  maskAccount,
  nameMatches,
  payoutReference,
  PAYOUT_REFERENCE,
  payoutStatusFor,
  shapeOf,
  transferFeeMinor,
  transfersInApproval,
  type LedgerPayout,
} from "../src/lib/ledger-rules";
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
function throws(label: string, fn: () => unknown) {
  try {
    fn();
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m  did not throw`);
  } catch {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}  throws`);
  }
}

const sold = new Date("2026-10-21T10:00:00+01:00");

console.log("\nWhat a sale earns");
const c = commissionFor(3_800_000_000, sold); // ₦38,000,000
eq("1.5% of ₦38,000,000", formatNaira(c.amountMinor), "₦570,000");
eq("the rate is kept with the row", c.rateBps, 150);
eq("an awkward price rounds to the kobo", commissionFor(3_333_333_333, sold).amountMinor, 50_000_000);
throws("a sale of nothing earns nothing", () => commissionFor(0, sold));
throws("a fractional price is refused", () => commissionFor(1.5, sold));

console.log("\nWhen it can be paid");
eq("cooling-off is two days", COOLING_OFF_HOURS, 48);
eq("payable two days after the sale", c.payableAt.toISOString(), "2026-10-23T09:00:00.000Z");
eq("not payable the next morning", isPayable({ status: "pending", payableAt: c.payableAt }, new Date("2026-10-22T09:00:00+01:00")), false);
eq("payable once the cooling-off has passed", isPayable({ status: "pending", payableAt: c.payableAt }, new Date("2026-10-23T10:00:00+01:00")), true);
eq("a paid commission is not payable again", isPayable({ status: "paid", payableAt: c.payableAt }, new Date("2026-11-01")), false);
eq("a void commission is never payable", isPayable({ status: "void", payableAt: c.payableAt }, new Date("2026-11-01")), false);

console.log("\nWhose account it is");
eq("surname first, in capitals, still matches", nameMatches("Emmanuel Abisoye", "ABISOYE EMMANUEL OLUWASEUN"), true);
eq("a middle name the partner never typed is fine", nameMatches("Adaeze Okafor", "OKAFOR ADAEZE CHIOMA"), true);
eq("one shared part is not enough for a two-part name", nameMatches("Emmanuel Abisoye", "EMMANUEL OKAFOR"), false);
eq("a different person does not match", nameMatches("Emmanuel Abisoye", "CHIDI OKEKE"), false);
eq("a single registered name needs one match", nameMatches("Tunde", "TUNDE BAKARE"), true);
eq("punctuation and hyphens are ignored", nameMatches("Mary-Ann Okoro", "OKORO MARY ANN"), true);
eq("an empty partner name never matches", nameMatches("", "ANYONE AT ALL"), false);

console.log("\nWhat Paystack charges to send it");
eq("₦10 on ₦5,000", transferFeeMinor(500_000), 1_000);
eq("₦25 on ₦5,001", transferFeeMinor(500_100), 2_500);
eq("₦25 on ₦50,000", transferFeeMinor(5_000_000), 2_500);
eq("₦50 on ₦570,000", transferFeeMinor(57_000_000), 5_000);

console.log("\nThe reference that makes a payout happen once");
const ref = payoutReference("1f36aad5-afd4-4956-a714-77d200f93bcd", "c22b5d99-1875-4dcc-aea8-78cabfff5f28");
eq("formed from the commission and a random part", ref, "scp_1f36aad5_c22b5d99");
eq("…in the shape the database insists on", PAYOUT_REFERENCE.test(ref), true);
throws("a short id cannot form one", () => payoutReference("abc", "def"));

console.log("\nWhat others see of an account");
eq("only the last four digits", maskAccount("0123456789"), "••••••6789");

console.log("\nWhat Paystack's word means for a payout");
eq("success is paid", payoutStatusFor("success"), "paid");
eq("received (waiting on the approval check) is still with the bank", payoutStatusFor("received"), "processing");
eq("pending is still with the bank", payoutStatusFor("pending"), "processing");
eq("rejected by the approval check is failed, so it can be paid again", payoutStatusFor("rejected"), "failed");
eq("blocked (the check did not answer) is failed", payoutStatusFor("blocked"), "failed");
eq("abandoned is failed", payoutStatusFor("abandoned"), "failed");
eq("reversed is reversed", payoutStatusFor("reversed"), "reversed");
eq("a blocked transfer says what to do", failureSentenceFor("blocked").includes("Pay it again"), true);

console.log("\nPaystack's approval check: only transfers this site started");
const REF = "scp_1f36aad5_c22b5d99";
const ledger = new Map<string, LedgerPayout>([[REF, { status: "pending", amountMinor: 57_000_000, recipientCode: "RCP_partner123" }]]);
const decide = (body: unknown) => approvalDecision(transfersInApproval(body), ledger);
eq("the flat initiate payload is approved", decide({ source: "balance", amount: 57_000_000, recipient: "RCP_partner123", reference: REF, currency: "NGN" }).approve, true);
eq("…and the same wrapped in data", decide({ event: "transfer.approval", data: { amount: 57_000_000, reference: REF, recipient: { recipient_code: "RCP_partner123" } } }).approve, true);
eq("…and with the amount as a string", decide({ amount: "57000000", reference: REF }).approve, true);
eq("…and as a one-item batch", decide({ transfers: [{ amount: 57_000_000, reference: REF, recipient: "RCP_partner123" }] }).approve, true);
eq("…and with the recipient as Paystack's numeric id, which is not compared", decide({ amount: 57_000_000, reference: REF, recipient: 56824902 }).approve, true);
eq("…and once it is with the bank", approvalDecision(transfersInApproval({ reference: REF }), new Map([[REF, { ...ledger.get(REF)!, status: "processing" }]])).approve, true);
eq("a transfer with someone else's reference is refused", decide({ amount: 57_000_000, reference: "trf_stolen_key_001", recipient: "RCP_thief" }).approve, false);
eq("a body with no reference at all is refused", decide({ amount: 57_000_000 }).approve, false);
eq("garbage is refused", decide(null).approve, false);
eq("a reference in our shape the ledger never made is refused", decide({ reference: "scp_00000000_00000000" }).approve, false);
eq("a different amount is refused", decide({ amount: 99_000_000, reference: REF }).approve, false);
eq("a different recipient is refused", decide({ amount: 57_000_000, reference: REF, recipient: "RCP_thief" }).approve, false);
eq("another currency is refused", decide({ amount: 57_000_000, reference: REF, currency: "USD" }).approve, false);
eq("a batch that slips in a foreign transfer is refused", decide({ transfers: [{ reference: REF, amount: 57_000_000 }, { reference: "thief_ref_0001", amount: 1 }] }).approve, false);
eq("a payout already paid is refused", approvalDecision(transfersInApproval({ reference: REF }), new Map([[REF, { ...ledger.get(REF)!, status: "paid" }]])).approve, false);
const refusal = decide({ reference: "trf_stolen_key_001" });
eq("a refusal says why", !refusal.approve && refusal.reason.includes("no payout reference this site made"), true);
const mixed = decide({ transfers: [{ reference: REF, amount: 57_000_000 }, { reference: "thief_ref_0001", amount: 1 }] });
eq("…and names a transfer slipped into a batch", !mixed.approve && mixed.reason.includes("did not start"), true);
eq("the kept outline has keys and types, never values", JSON.stringify(shapeOf({ reference: REF, amount: 5, recipient: { name: "Ada" } })), JSON.stringify({ reference: "string", amount: "number", recipient: { name: "string" } }));

console.log(`\n${passed} passed, ${failed} failed.` + (failed ? "  \x1b[31mLEDGER NOT VERIFIED\x1b[0m\n" : "  \x1b[32mLedger verified.\x1b[0m\n"));
process.exit(failed ? 1 : 0);
