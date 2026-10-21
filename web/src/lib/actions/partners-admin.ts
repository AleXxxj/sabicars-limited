"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { can, requireStaff } from "@/lib/auth";
import { confirmBankAccount, setPartnerStatus, voidCommission } from "@/lib/ledger";
import { notifyAccountSaved } from "@/lib/ledger-notify";

/**
 * What a manager does to a partner from the admin: confirms the bank account
 * is theirs, suspends or reactivates them, voids a commission that should
 * not be paid. The ledger core makes the change and writes the audit entry;
 * this file checks who is asking, what they sent, and refreshes the pages
 * that show the result.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
}

const NOT_ALLOWED = "Only a manager or the owner can do this.";

/** The partner list, the partner's own page, the payout queue, and the Payouts badge in every admin page's navigation. */
function refresh(partnerId?: string) {
  revalidatePath("/admin/partners");
  if (partnerId) revalidatePath(`/admin/partners/${partnerId}`);
  else revalidatePath("/admin/partners/[id]", "page");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin", "layout");
}

/** A manager has checked that the registered account is in the partner's own name. */
export async function confirmBankAccountAction(partnerId: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: NOT_ALLOWED };
  const parsed = z.uuid().safeParse(partnerId);
  if (!parsed.success) return { ok: false, error: "Partner not found." };
  const r = await confirmBankAccount(me, parsed.data);
  if (!r.ok) return r;
  after(async () => {
    try {
      await notifyAccountSaved(parsed.data);
    } catch (e) {
      console.error("[partners] account-confirmed notice failed", e);
    }
  });
  refresh(parsed.data);
  return { ok: true };
}

const statusSchema = z.object({ partnerId: z.uuid(), status: z.enum(["active", "suspended"]) });

/** Suspends a partner (their link stops attributing and nothing is paid out) or reactivates them. */
export async function setPartnerStatusAction(partnerId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: NOT_ALLOWED };
  const parsed = statusSchema.safeParse({ partnerId, status });
  if (!parsed.success) return { ok: false, error: "That change could not be saved." };
  const r = await setPartnerStatus(me, parsed.data.partnerId, parsed.data.status);
  if (!r.ok) return r;
  refresh(parsed.data.partnerId);
  return { ok: true };
}

const voidSchema = z.object({
  commissionId: z.uuid(),
  reason: z.string().trim().min(3, "Give the reason — the partner will read it.").max(300, "Keep the reason under 300 characters."),
});

/** Voids a pending commission, with a reason the partner reads on their page. */
export async function voidCommissionAction(commissionId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!can.payPartners(me)) return { ok: false, error: NOT_ALLOWED };
  const parsed = voidSchema.safeParse({ commissionId, reason });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
    return { ok: false, fieldErrors, error: fieldErrors.reason ?? "That commission could not be voided." };
  }
  const r = await voidCommission(me, parsed.data.commissionId, parsed.data.reason);
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}
