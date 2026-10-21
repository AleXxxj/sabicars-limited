import { REFERRAL_COMMISSION_BPS, commissionMinor } from "@/lib/referral";

/**
 * The rules of the commission ledger, with no server imports, so the build
 * can prove them (scripts/verify-ledger.ts) and the partner's page and the
 * admin can share them.
 *
 * What the owner confirmed: 1.5% of what the car sold for; one commission
 * per vehicle; paid only after the sale is final and a cooling-off has
 * passed; paid only into a bank account in the partner's own name, whose
 * holder's name is checked before the first payout; never for recruiting.
 */

/** "A day or two" in the programme's own words: the sale must stand this long before the commission is paid. */
export const COOLING_OFF_HOURS = 48;

/** The commission a sale earns, and when it becomes payable. */
export function commissionFor(salePriceMinor: number, earnedAt: Date): { amountMinor: number; rateBps: number; payableAt: Date } {
  if (!Number.isInteger(salePriceMinor) || salePriceMinor <= 0) throw new RangeError("A sale price is whole kobo above zero.");
  return {
    amountMinor: commissionMinor(salePriceMinor),
    rateBps: REFERRAL_COMMISSION_BPS,
    payableAt: new Date(earnedAt.getTime() + COOLING_OFF_HOURS * 60 * 60 * 1000),
  };
}

/** A pending commission whose cooling-off has passed. */
export function isPayable(c: { status: string; payableAt: Date }, now = new Date()): boolean {
  return c.status === "pending" && c.payableAt.getTime() <= now.getTime();
}

/**
 * Does the name the bank holds for an account belong to this partner?
 * Banks return the name in capitals, often surname first and sometimes with
 * a middle name the partner never typed, so the test is on name parts, not
 * the whole string: at least two parts in common (one when the partner
 * registered a single name), ignoring order, case and punctuation.
 */
export function nameMatches(partnerName: string, accountName: string): boolean {
  const parts = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1);
  const mine = new Set(parts(partnerName));
  const theirs = parts(accountName);
  const shared = theirs.filter((p) => mine.has(p)).length;
  return mine.size === 0 ? false : mine.size === 1 ? shared >= 1 : shared >= 2;
}

/** Paystack's published fee on a naira transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above. */
export function transferFeeMinor(amountMinor: number): number {
  if (amountMinor <= 500_000) return 1_000;
  if (amountMinor <= 5_000_000) return 2_500;
  return 5_000;
}

/** "scp_" + eight characters of the commission id + eight random — unique, ours, sent to Paystack as the idempotency key. */
export const PAYOUT_REFERENCE = /^scp_[a-z0-9]{8}_[a-z0-9]{8}$/;

export function payoutReference(commissionId: string, random: string): string {
  const ref = `scp_${commissionId.replace(/-/g, "").slice(0, 8)}_${random.replace(/-/g, "").slice(0, 8)}`.toLowerCase();
  if (!PAYOUT_REFERENCE.test(ref)) throw new RangeError("Could not form a payout reference.");
  return ref;
}

/** "••••••1234": what anyone but the partner sees of an account number. */
export function maskAccount(accountNumber: string): string {
  return `••••••${accountNumber.slice(-4)}`;
}

/** The order a ledger is read in: what is owed and nearest to payable first, then what was paid, then what was voided. */
export const COMMISSION_STATUS_LABEL: Record<"pending" | "paid" | "void", string> = {
  pending: "Pending",
  paid: "Paid",
  void: "Void",
};

export const PAYOUT_STATUS_LABEL: Record<"pending" | "processing" | "paid" | "failed" | "reversed", string> = {
  pending: "Starting",
  processing: "With the bank",
  paid: "Paid",
  failed: "Failed",
  reversed: "Returned",
};
