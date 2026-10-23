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

/**
 * Paystack's transfer statuses, as its API, webhooks and verify endpoint
 * report them. "received" is a transfer waiting on Sabicars' approval check
 * (Paystack → Transfer approvals). "rejected" is that check saying no, and
 * "blocked" is Paystack stopping a transfer whose check did not answer within
 * a few seconds: both are final, and Paystack stops before sending.
 */
export type TransferStatus = "pending" | "otp" | "received" | "success" | "failed" | "reversed" | "abandoned" | "rejected" | "blocked";
export const TRANSFER_STATUSES: readonly TransferStatus[] = ["pending", "otp", "received", "success", "failed", "reversed", "abandoned", "rejected", "blocked"];

/** What a transfer's status means for our payout row. Anything not final keeps it "processing": with the bank. */
export function payoutStatusFor(status: TransferStatus): "processing" | "paid" | "failed" | "reversed" {
  switch (status) {
    case "success":
      return "paid";
    case "failed":
    case "abandoned":
    case "rejected":
    case "blocked":
      return "failed";
    case "reversed":
      return "reversed";
    default:
      return "processing";
  }
}

/** The sentence a payout carries when Paystack ends it without a reason of its own. */
export function failureSentenceFor(status: TransferStatus): string {
  if (status === "rejected") return "Refused by Sabicars' transfer approval check, so Paystack did not send it.";
  if (status === "blocked") return "Paystack stopped it because the transfer approval check did not answer in time. Pay it again.";
  return "Paystack reported the transfer as not completed.";
}

/** One transfer Paystack asks Sabicars to approve, as found in its request. */
export interface ApprovalTransfer {
  reference: string;
  amountMinor?: number;
  currency?: string;
  recipientCode?: string;
}

const integerOf = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;

function recipientCodeOf(o: Record<string, unknown>): string | undefined {
  const r = o.recipient;
  if (typeof r === "string" && r.startsWith("RCP_")) return r;
  if (typeof o.recipient_code === "string") return o.recipient_code;
  if (r && typeof r === "object" && typeof (r as { recipient_code?: unknown }).recipient_code === "string") return (r as { recipient_code: string }).recipient_code;
  return undefined;
}

/**
 * The transfers in a Paystack approval request, wherever they sit. Paystack
 * documents only that the request carries "the payload used to initiate the
 * transfer request", not its shape, and not whether a bulk batch comes as one
 * request or many. So any object in the body holding one of our references is
 * a transfer, with the amount, currency and recipient code beside it when
 * they are there; any other object with a `reference` is a transfer this site
 * did not start.
 */
export function transfersInApproval(body: unknown): { ours: ApprovalTransfer[]; foreign: number } {
  const ours: ApprovalTransfer[] = [];
  let foreign = 0;
  let visited = 0;
  const visit = (node: unknown, depth: number) => {
    if (node === null || typeof node !== "object" || depth > 8 || ++visited > 2000) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const o = node as Record<string, unknown>;
    const refs = new Set(Object.values(o).filter((v): v is string => typeof v === "string" && PAYOUT_REFERENCE.test(v)));
    for (const reference of refs) {
      ours.push({ reference, amountMinor: integerOf(o.amount), currency: typeof o.currency === "string" ? o.currency : undefined, recipientCode: recipientCodeOf(o) });
    }
    if (!refs.size && typeof o.reference === "string" && o.reference.trim()) foreign++;
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v, depth + 1);
  };
  visit(body, 0);
  return { ours, foreign };
}

/** A payout as the ledger holds it, for the approval check. */
export interface LedgerPayout {
  status: string;
  amountMinor: number;
  recipientCode: string | null;
}

/**
 * Whether to approve a transfer Paystack is about to send. Only if every
 * transfer in the request is a Paystack payout this site recorded, still
 * waiting to be sent, and any amount, currency and recipient beside it are
 * the ones recorded. Anything else is refused: with the transfer code off, a
 * stolen secret key could otherwise empty the balance.
 */
export function approvalDecision(found: { ours: ApprovalTransfer[]; foreign: number }, ledger: ReadonlyMap<string, LedgerPayout>): { approve: true } | { approve: false; reason: string } {
  const no = (reason: string) => ({ approve: false as const, reason });
  if (!found.ours.length) return no("the request carries no payout reference this site made");
  if (found.foreign) return no(`the request includes ${found.foreign === 1 ? "a transfer" : `${found.foreign} transfers`} this site did not start`);
  for (const t of found.ours) {
    const row = ledger.get(t.reference);
    if (!row) return no(`${t.reference} is not a payout this site recorded`);
    if (row.status !== "pending" && row.status !== "processing") return no(`${t.reference} is ${row.status}, not waiting to be sent`);
    if (t.amountMinor !== undefined && t.amountMinor !== row.amountMinor) return no(`${t.reference} asks for ${t.amountMinor} kobo, the ledger says ${row.amountMinor}`);
    if (t.currency !== undefined && t.currency.toUpperCase() !== "NGN") return no(`${t.reference} is in ${t.currency}, not naira`);
    if (t.recipientCode && row.recipientCode && t.recipientCode !== row.recipientCode) return no(`${t.reference} is going to a different recipient than the partner's account`);
  }
  return { approve: true };
}

/** The outline of a request, every value replaced by its type: what Paystack sends, with nothing personal in it. */
export function shapeOf(node: unknown, depth = 0): unknown {
  if (node === null) return "null";
  if (Array.isArray(node)) return depth > 6 ? "array" : [node.length, node.length ? shapeOf(node[0], depth + 1) : "empty"];
  if (typeof node === "object") {
    if (depth > 6) return "object";
    return Object.fromEntries(Object.entries(node as Record<string, unknown>).slice(0, 60).map(([k, v]) => [k, shapeOf(v, depth + 1)]));
  }
  return typeof node;
}
