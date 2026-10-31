import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TransferStatus } from "@/lib/ledger-rules";

/**
 * Paystack, for paying partners: the bank list, "resolve account" (the name
 * the bank holds for a number), transfer recipients, transfers from
 * Sabicars' balance, and the webhook signature. Plain fetch, amounts in
 * kobo, one secret key in PAYSTACK_SECRET_KEY, set only in Vercel.
 *
 * Every call that fails throws a PayoutError with a message fit for a staff
 * screen; Paystack's own wording is logged, never shown.
 */

const API = "https://api.paystack.co";
const TIMEOUT_MS = 12_000;

export class PayoutError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "PayoutError";
  }
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

/** True when the key is a test key: transfers settle instantly and no real money moves. */
export function paystackTestMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY?.trim() ?? "").startsWith("sk_test_");
}

function secret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new PayoutError("Paystack is not set up yet: add PAYSTACK_SECRET_KEY in Vercel.", false);
  return key;
}

interface Reply<T> {
  status: boolean;
  message?: string;
  data?: T;
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, failure: string): Promise<T> {
  let reply: Reply<T>;
  let httpStatus = 0;
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    httpStatus = res.status;
    reply = (await res.json()) as Reply<T>;
  } catch (e) {
    if (e instanceof PayoutError) throw e;
    console.error(`[paystack] ${redacted(path)} failed`, e instanceof Error ? e.message : e);
    throw new PayoutError(`${failure} Paystack did not answer; try again in a moment.`);
  }
  if (!reply.status || reply.data === undefined) {
    console.error(`[paystack] ${redacted(path)} refused (${httpStatus}): ${reply.message ?? "no message"}`);
    // 4xx is Paystack saying no to this request; sending it again will not help.
    throw new PayoutError(`${failure} ${reasonFor(reply.message)}`, httpStatus >= 500 || httpStatus === 0);
  }
  return reply.data;
}

/** A path fit for a log line: an account number never goes into the logs whole. */
const redacted = (path: string) => path.replace(/account_number=[^&]*/, "account_number=••••");

/** Paystack's wording, where a staff member can act on it; a plain sentence otherwise. */
function reasonFor(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("insufficient")) return "Sabicars' Paystack balance is too low: top it up on the Paystack dashboard, then try again.";
  if (m.includes("could not resolve") || m.includes("unknown bank") || m.includes("invalid account")) return "The bank could not find that account number. Check the number and the bank.";
  if (m.includes("otp")) return "Paystack is asking for an OTP on transfers. Turn off 'Confirm transfers before sending' in Paystack's Preferences so payouts can go through.";
  if (m.includes("third party") || m.includes("enable")) return "Transfers are not enabled on Sabicars' Paystack account yet. Paystack enables them once the business is registered and verified.";
  return "Paystack refused the request.";
}

export interface Bank {
  name: string;
  code: string;
}

let banksCache: { at: number; banks: Bank[] } | null = null;

/** Every Nigerian bank Paystack can pay, cached for a day; the list changes rarely. */
export async function listBanks(): Promise<Bank[]> {
  if (banksCache && Date.now() - banksCache.at < 86_400_000) return banksCache.banks;
  const data = await call<{ name: string; code: string; active: boolean; currency: string }[]>("/bank?currency=NGN&perPage=100", {}, "Could not load the bank list.");
  const banks = data
    .filter((b) => b.active !== false && b.currency === "NGN")
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  banksCache = { at: Date.now(), banks };
  return banks;
}

/** The name the bank holds for an account: the check that a payout goes to the partner and nobody else. */
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string }> {
  const data = await call<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    {},
    "Could not confirm the account.",
  );
  return { accountName: data.account_name, accountNumber: data.account_number };
}

/** Registers the account with Paystack so transfers can name it by code. Called only after the account is verified. */
export async function createRecipient(input: { name: string; accountNumber: string; bankCode: string }): Promise<{ recipientCode: string }> {
  const data = await call<{ recipient_code: string }>(
    "/transferrecipient",
    { method: "POST", body: { type: "nuban", name: input.name, account_number: input.accountNumber, bank_code: input.bankCode, currency: "NGN" } },
    "Could not register the account with Paystack.",
  );
  return { recipientCode: data.recipient_code };
}

export type { TransferStatus };

/**
 * Sends money from Sabicars' Paystack balance. `reference` is ours and
 * unique: Paystack treats a repeated reference as the same transfer, so a
 * retry after a timeout cannot pay twice.
 */
export async function initiateTransfer(input: { amountMinor: number; recipientCode: string; reference: string; reason: string }): Promise<{ transferCode: string; status: TransferStatus }> {
  const data = await call<{ transfer_code: string; status: TransferStatus }>(
    "/transfer",
    { method: "POST", body: { source: "balance", amount: input.amountMinor, recipient: input.recipientCode, reference: input.reference, reason: input.reason, currency: "NGN" } },
    "Could not send the transfer.",
  );
  return { transferCode: data.transfer_code, status: data.status };
}

/**
 * The transfer's state as Paystack has it now — the source of truth after a
 * timeout or a webhook. `reason` on a transfer is the narration we sent, not
 * why it failed; the failure, when Paystack gives one, is in `failures`.
 */
export async function verifyTransfer(reference: string): Promise<{ transferCode: string | null; status: TransferStatus; amountMinor: number; failureReason: string | null }> {
  const data = await call<{ transfer_code?: string; status: TransferStatus; amount: number; failures?: unknown }>(
    `/transfer/verify/${encodeURIComponent(reference)}`,
    {},
    "Could not check the transfer.",
  );
  return { transferCode: data.transfer_code ?? null, status: data.status, amountMinor: data.amount, failureReason: failureText(data.failures) };
}

/** Whatever shape Paystack puts a failure in, as one sentence or nothing. */
export function failureText(failures: unknown): string | null {
  if (!failures) return null;
  if (typeof failures === "string") return failures;
  if (typeof failures === "object") {
    const f = failures as { reason?: unknown; message?: unknown };
    if (typeof f.reason === "string") return f.reason;
    if (typeof f.message === "string") return f.message;
  }
  return null;
}

/** Sabicars' naira balance at Paystack, in kobo: what transfers draw on. */
export async function balanceMinor(): Promise<number> {
  const data = await call<{ currency: string; balance: number }[]>("/balance", {}, "Could not read the balance.");
  return data.find((b) => b.currency === "NGN")?.balance ?? 0;
}

/** Paystack signs each webhook body with the secret key (HMAC-SHA512, header x-paystack-signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !paystackConfigured()) return false;
  const expected = Buffer.from(createHmac("sha512", secret()).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/* ── Collecting a deposit (reserving a car) ───────────────────────────── */

/** Paystack refuses a single transaction above this (docs: "10,000,000 for all supported currencies"), in kobo. */
export const PAYSTACK_MAX_MINOR = 10_000_000 * 100;

/**
 * Starts a payment on Paystack's hosted checkout and returns the page to send
 * the buyer to. The reference is ours, so the payment finds its row when it
 * comes back — by the buyer returning, or by the webhook.
 */
export async function initializeTransaction(input: {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl: string;
  channels?: ("card" | "bank_transfer" | "ussd")[];
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const data = await call<{ authorization_url: string; access_code: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: {
        email: input.email,
        amount: input.amountMinor,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: input.channels ?? ["card", "bank_transfer"],
        metadata: input.metadata ?? {},
      },
    },
    "The payment could not be started.",
  );
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
}

export interface PaymentOutcome {
  /** success · failed · abandoned · ongoing · pending · processing · reversed … */
  status: string;
  reference: string;
  amountMinor: number;
  currency: string;
  channel: string | null;
  feeMinor: number | null;
  paidAt: Date | null;
  /** Who paid, as Paystack saw it: the name on a transfer, or the card's last four digits. */
  paidBy: string | null;
}

/** The outcome of a payment, from Paystack's record of it, never from the page the buyer came back to. */
export async function verifyTransaction(reference: string): Promise<PaymentOutcome> {
  const data = await call<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel?: string | null;
    fees?: number | null;
    paid_at?: string | null;
    authorization?: { last4?: string | null; sender_name?: string | null; sender_bank?: string | null; bank?: string | null; channel?: string | null } | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, {}, "Could not check the payment.");
  return paymentOutcome(data);
}

/** The same reading of a payment, whether it came from verify or from a charge.success webhook. */
export function paymentOutcome(data: {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string | null;
  fees?: number | null;
  paid_at?: string | null;
  authorization?: { last4?: string | null; sender_name?: string | null; sender_bank?: string | null; bank?: string | null; channel?: string | null } | null;
}): PaymentOutcome {
  const a = data.authorization ?? null;
  // A transfer names its sender and their bank; a card, its last four digits.
  const bank = a?.sender_bank ?? a?.bank ?? null;
  const paidBy = a?.sender_name ? `${a.sender_name}${bank ? `, ${bank}` : ""}` : a?.last4 && data.channel !== "bank_transfer" ? `card ending ${a.last4}` : null;
  return {
    status: data.status,
    reference: data.reference,
    amountMinor: data.amount,
    currency: data.currency,
    channel: data.channel ?? null,
    feeMinor: typeof data.fees === "number" ? data.fees : null,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    paidBy,
  };
}

/** Sends part of a payment back to the buyer. Paystack's fee is not returned; the refund lands in 3–10 working days. */
export async function refundTransaction(reference: string, amountMinor: number, note: string): Promise<{ status: string }> {
  const data = await call<{ status: string }>(
    "/refund",
    { method: "POST", body: { transaction: reference, amount: amountMinor, currency: "NGN", customer_note: note, merchant_note: note } },
    "The refund could not be sent.",
  );
  return { status: data.status };
}

/** Refunds Paystack already holds for a payment, so a retry never sends a second one. */
export async function refundsFor(reference: string): Promise<{ id: number; status: string; amountMinor: number }[]> {
  const data = await call<{ id: number; status: string; amount: number }[]>(
    `/refund?transaction=${encodeURIComponent(reference)}&perPage=20`,
    {},
    "Could not check earlier refunds.",
  );
  return data.map((r) => ({ id: r.id, status: r.status, amountMinor: r.amount }));
}
