"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commissions, partners, payouts } from "@/db/schema";
import { can, requireStaff, type StaffMember } from "@/lib/auth";
import { payByPaystack, recordBankTransfer, recordCommissionForSale, type RecordResult } from "@/lib/ledger";
import { notifyCommissionPaid, notifyCommissionRecorded, notifyPayoutFailed } from "@/lib/ledger-notify";
import { formatNaira } from "@/lib/money";

/**
 * Paying partners, and attributing the showroom sale that earns a
 * commission. The ledger core (lib/ledger.ts) makes every change and writes
 * its own audit entry; this file checks who is asking and what they sent,
 * refreshes the pages that show the result, and tells people afterwards.
 */

export interface PayoutActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** On success: what happened, in a sentence the screen can show. */
  message?: string;
}

const NOT_ALLOWED = "Only a manager or the owner can pay partners.";

const dateLagos = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** The pages that show a commission: the queue, the partner list and page, the vehicle, and the Payouts badge in every admin page's navigation. */
function refresh(vehicleId: string | null, partnerId: string | null) {
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/partners");
  if (partnerId) revalidatePath(`/admin/partners/${partnerId}`);
  if (vehicleId) revalidatePath(`/admin/vehicles/${vehicleId}`);
  revalidatePath("/admin", "layout");
}

/** After the response: a notice that must never delay or fail the change it is about. */
function tell(what: string, fn: () => Promise<void>) {
  after(async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[payouts] ${what} failed`, e);
    }
  });
}

async function commissionRefs(me: StaffMember, commissionId: string): Promise<{ vehicleId: string; partnerId: string } | null> {
  const [c] = await db
    .select({ vehicleId: commissions.vehicleId, partnerId: commissions.partnerId })
    .from(commissions)
    .where(and(eq(commissions.id, commissionId), eq(commissions.dealerId, me.dealerId)))
    .limit(1);
  return c ?? null;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0] ?? "Check this field"]));
}

/* ── Paying ─────────────────────────────────────────────────────────────── */

/** Sends the commission from Sabicars' Paystack balance to the partner's verified account. */
export async function payByPaystackAction(commissionId: string): Promise<PayoutActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: NOT_ALLOWED };
  const parsed = z.uuid().safeParse(commissionId);
  if (!parsed.success) return { ok: false, error: "That commission does not exist." };
  const id = parsed.data;

  const refs = await commissionRefs(me, id);
  const r = await payByPaystack(me, id);
  refresh(refs?.vehicleId ?? null, refs?.partnerId ?? null);

  if (!r.ok) {
    // When the core got as far as a payout row before Paystack refused, that row
    // is now marked failed; managers are told about it. A refusal before the row
    // (no verified account, balance too low) has nothing on record to tell about.
    tell("failed-transfer notice", async () => {
      const [failed] = await db
        .select({ id: payouts.id })
        .from(payouts)
        .where(and(eq(payouts.commissionId, id), eq(payouts.status, "failed"), eq(payouts.recordedBy, me.id), gte(payouts.createdAt, new Date(Date.now() - 5 * 60_000))))
        .orderBy(desc(payouts.createdAt))
        .limit(1);
      if (failed) await notifyPayoutFailed(failed.id);
    });
    return { ok: false, error: r.error };
  }

  if (r.status === "paid") tell("paid notice", () => notifyCommissionPaid(r.payoutId));
  else if (r.status === "failed" || r.status === "reversed") tell("failed-transfer notice", () => notifyPayoutFailed(r.payoutId));

  return {
    ok: true,
    message:
      r.status === "paid"
        ? "Paid."
        : r.status === "failed" || r.status === "reversed"
          ? "Paystack did not complete the transfer. The reason is listed under Failed."
          : "Sent. Paystack confirms once the bank has it; until then it is listed under With the bank.",
  };
}

const bankTransferSchema = z.object({
  commissionId: z.uuid(),
  bankReference: z
    .string()
    .trim()
    .min(4, "Enter the bank's reference or teller number — at least 4 characters.")
    .max(80, "Keep the reference under 80 characters."),
  paidOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date it was paid.")
    // Midnight in Lagos (WAT, no daylight saving), so "today" is never a few hours in the future.
    .transform((d) => new Date(`${d}T00:00:00+01:00`))
    .refine((d) => !Number.isNaN(d.getTime()), "Enter the date it was paid."),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300, "Keep the note under 300 characters.").optional()),
});

/** Records a commission paid by a transfer made from the bank, outside the platform. The bank's reference is the proof. */
export async function recordBankTransferAction(_prev: PayoutActionResult | null, formData: FormData): Promise<PayoutActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: NOT_ALLOWED };
  const parsed = bankTransferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return { ok: false, error: fieldErrors.commissionId ? "That commission does not exist." : "Some fields need attention.", fieldErrors };
  }
  const { commissionId, bankReference, paidOn, note } = parsed.data;

  const refs = await commissionRefs(me, commissionId);
  const r = await recordBankTransfer(me, commissionId, { bankReference, paidOn, note });
  if (!r.ok) return { ok: false, error: r.error };

  refresh(refs?.vehicleId ?? null, refs?.partnerId ?? null);
  tell("paid notice", () => notifyCommissionPaid(r.payoutId));
  return { ok: true, message: "Recorded as paid." };
}

/* ── The sale that earns it ─────────────────────────────────────────────── */

const attributeSchema = z.object({
  vehicleId: z.uuid(),
  code: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() : v),
    z.string().regex(/^[A-Z0-9]{6}$/, "A partner code is six letters and numbers, e.g. ADA7K3."),
  ),
});

/** Each way the ledger can decline, as a sentence a manager can act on. */
const DECLINED: Record<Extract<RecordResult, { ok: false }>["reason"], string> = {
  not_sold: "Mark the car sold first.",
  no_price: "Record what it sold for first.",
  no_attribution: "No partner is on record for this buyer.",
  partner_unknown: "No active partner has that code.",
  partner_is_buyer: "The buyer is this partner: partner price, no commission.",
  already_recorded: "This sale already has a commission.",
};

/** A manager attributes a showroom sale to the partner whose code the buyer gave. One commission per vehicle. */
export async function attributeSaleAction(_prev: PayoutActionResult | null, formData: FormData): Promise<PayoutActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: "Only a manager or the owner can attribute a sale to a partner." };
  const parsed = attributeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return { ok: false, error: fieldErrors.code ?? "That vehicle does not exist.", fieldErrors };
  }
  const { vehicleId, code } = parsed.data;

  const [partner] = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(and(eq(partners.dealerId, me.dealerId), eq(partners.code, code), eq(partners.status, "active")))
    .limit(1);
  if (!partner) return { ok: false, error: DECLINED.partner_unknown, fieldErrors: { code: DECLINED.partner_unknown } };

  const r = await recordCommissionForSale(me.dealerId, vehicleId, { source: "manual", partnerId: partner.id, actor: me });
  if (!r.ok) return { ok: false, error: DECLINED[r.reason] };
  if (!r.created) return { ok: false, error: DECLINED.already_recorded };

  refresh(vehicleId, partner.id);
  tell("commission-recorded notice", () => notifyCommissionRecorded(r.commissionId));

  const [c] = await db.select({ amountMinor: commissions.amountMinor, payableAt: commissions.payableAt }).from(commissions).where(eq(commissions.id, r.commissionId)).limit(1);
  return {
    ok: true,
    message: c ? `${formatNaira(c.amountMinor)} recorded for ${partner.name} (${code}), payable from ${dateLagos(c.payableAt)}.` : `Recorded for ${partner.name} (${code}).`,
  };
}
