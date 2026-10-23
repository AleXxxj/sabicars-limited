import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { partners, payouts, settings } from "@/db/schema";
import { recordIncident } from "@/lib/incidents";
import { sabicarsDealerId } from "@/lib/leads";
import { approvalDecision, shapeOf, transfersInApproval, type LedgerPayout } from "@/lib/ledger-rules";
import { verifyWebhookSignature } from "@/lib/paystack";

/**
 * Paystack's transfer approval check: before sending any transfer from
 * Sabicars' balance, Paystack asks this address, and sends it only on a 200.
 * Set in the Paystack dashboard as <site>/api/payments/paystack/approve
 * (Transfer approvals, "Confirm transfers in live mode"; docs/LAUNCH.md).
 *
 * It is what makes switching off Paystack's transfer code safe: a transfer
 * someone started with a stolen secret key carries no reference this site
 * recorded, so it is refused (400) and the managers are alerted. Only a
 * Paystack payout the ledger holds, still waiting to be sent, with the same
 * amount and recipient, is approved. The payout row is written before
 * Paystack is called (ledger.ts payByPaystack), so it is always here first.
 *
 * Paystack does not document the request's shape or whether it is signed,
 * so nothing here depends on either: our references are found wherever they
 * sit, and a signature, when one comes, is only noted. The outline of the
 * latest request (keys and types, no values) is kept in settings as
 * `paystack_approval_last`, to see what Paystack really sends. Paystack
 * blocks a transfer whose check does not answer within a few seconds, so the
 * check is one query and everything else happens after the answer.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Not JSON: no reference can be found, so it is refused below.
  }
  const found = transfersInApproval(body);

  let decision: ReturnType<typeof approvalDecision>;
  try {
    const references = [...new Set(found.ours.map((t) => t.reference))];
    const rows = references.length
      ? await db
          .select({ reference: payouts.reference, status: payouts.status, amountMinor: payouts.amountMinor, recipientCode: partners.paystackRecipientCode })
          .from(payouts)
          .innerJoin(partners, eq(partners.id, payouts.partnerId))
          .where(and(inArray(payouts.reference, references), eq(payouts.method, "paystack")))
      : [];
    decision = approvalDecision(found, new Map<string, LedgerPayout>(rows.map((r) => [r.reference, r])));
  } catch (e) {
    decision = { approve: false, reason: `the ledger could not be read (${e instanceof Error ? e.message.slice(0, 120) : "unknown error"})` };
  }

  const signature = request.headers.get("x-paystack-signature");
  after(async () => {
    try {
      const dealerId = await sabicarsDealerId();
      const value = {
        at: new Date().toISOString(),
        approved: decision.approve,
        transfers: found.ours.length,
        signature: signature ? (verifyWebhookSignature(raw, signature) ? "valid" : "present, not the webhook signature") : "none",
        contentType: request.headers.get("content-type"),
        shape: shapeOf(body),
      };
      await db
        .insert(settings)
        .values({ dealerId, key: "paystack_approval_last", value })
        .onConflictDoUpdate({ target: [settings.dealerId, settings.key], set: { value, updatedAt: new Date() } });
    } catch (e) {
      console.error("[paystack approve] could not keep the request's outline", e);
    }
    if (!decision.approve) {
      await recordIncident({
        kind: "server",
        message: `Paystack transfer refused by the approval check: ${decision.reason}. If nobody at Sabicars started this transfer, rotate the Paystack secret key now.`,
        path: "/api/payments/paystack/approve",
        method: "POST",
      });
    }
  });

  return Response.json({}, { status: decision.approve ? 200 : 400 });
}
