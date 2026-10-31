import { after } from "next/server";
import { applyTransferEvent } from "@/lib/ledger";
import { notifyCommissionPaid, notifyPayoutFailed } from "@/lib/ledger-notify";
import { TRANSFER_STATUSES, type TransferStatus } from "@/lib/ledger-rules";
import { paymentOutcome, verifyWebhookSignature } from "@/lib/paystack";
import { applyRefundEvent, confirmReservation } from "@/lib/reserve";

/**
 * Paystack's webhook: how a transfer's outcome reaches the ledger when the
 * transfer request itself returned "pending". Set in the Paystack dashboard
 * as <site>/api/payments/paystack/webhook (docs/LAUNCH.md).
 *
 * Nothing in the body is trusted for money. The signature proves Paystack
 * sent it; the reference finds OUR payout row, and the core moves only that
 * row, only forwards. An unknown reference is acknowledged and ignored.
 * Every event is answered 200 so Paystack stops sending it, except when the
 * ledger itself threw, which is a 500 so Paystack retries later.
 */

export const dynamic = "force-dynamic";

interface TransferData {
  reference?: unknown;
  status?: unknown;
  transfer_code?: unknown;
  reason?: unknown;
  failures?: unknown;
}

/** The outcome, from the event name first (transfer.success → success); data.status only for a transfer.* event we do not know by name. */
function statusOf(event: string, data: TransferData): TransferStatus | null {
  if (event === "transfer.success") return "success";
  if (event === "transfer.failed") return "failed";
  if (event === "transfer.reversed") return "reversed";
  // Not in Paystack's list of events, but reported in the wild after an approval check refused a transfer.
  if (event === "transfer.rejected") return "rejected";
  const given = typeof data.status === "string" ? data.status : "";
  return (TRANSFER_STATUSES as readonly string[]).includes(given) ? (given as TransferStatus) : null;
}

/**
 * Why a transfer failed, when Paystack says. `data.reason` on a transfer is
 * the narration we sent ("Sabicars commission · …"), not a failure reason, so
 * it is never stored as one; `failures` carries the bank's message when
 * there is one. Without either, the ledger writes its own plain sentence.
 */
function failureReasonOf(data: TransferData): string | undefined {
  const f = data.failures;
  if (typeof f === "string" && f.trim()) return f.trim().slice(0, 300);
  if (f && typeof f === "object" && "reason" in f && typeof (f as { reason?: unknown }).reason === "string") {
    const reason = (f as { reason: string }).reason.trim();
    if (reason) return reason.slice(0, 300);
  }
  return undefined;
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, signature)) return Response.json({ error: "Bad signature." }, { status: 400 });

  let body: { event?: unknown; data?: unknown };
  try {
    body = JSON.parse(raw) as { event?: unknown; data?: unknown };
  } catch {
    return Response.json({ error: "Not JSON." }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";

  // A deposit paid on a car (lib/reserve.ts): our `scr_` reference finds the reservation; anything else is acknowledged.
  if (event === "charge.success") {
    const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
    const reference = typeof data.reference === "string" ? data.reference : "";
    if (!reference.startsWith("scr_")) return Response.json({ received: true });
    try {
      const outcome = await confirmReservation(
        paymentOutcome({
          status: typeof data.status === "string" ? data.status : "",
          reference,
          amount: typeof data.amount === "number" ? data.amount : 0,
          currency: typeof data.currency === "string" ? data.currency : "",
          channel: typeof data.channel === "string" ? data.channel : null,
          fees: typeof data.fees === "number" ? data.fees : null,
          paid_at: typeof data.paid_at === "string" ? data.paid_at : null,
          authorization: data.authorization && typeof data.authorization === "object" ? (data.authorization as { last4?: string | null; sender_name?: string | null; sender_bank?: string | null; bank?: string | null; channel?: string | null }) : null,
        }),
      );
      return Response.json({ received: true, outcome });
    } catch (e) {
      console.error("[paystack webhook] reservation failed", reference, e);
      return Response.json({ error: "Could not record the deposit." }, { status: 500 });
    }
  }

  // A refund we sent on a deposit: failed means the money never moved, and the reservation is put back.
  if (event.startsWith("refund.")) {
    const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
    const reference = typeof data.transaction_reference === "string" ? data.transaction_reference : "";
    if (!reference.startsWith("scr_")) return Response.json({ received: true });
    const status = event.slice("refund.".length) as "processed" | "failed" | "pending" | "processing" | "needs-attention";
    try {
      const outcome = await applyRefundEvent(reference, status, typeof data.reason === "string" ? data.reason : null);
      return Response.json({ received: true, outcome });
    } catch (e) {
      console.error("[paystack webhook] refund event failed", reference, e);
      return Response.json({ error: "Could not record the refund." }, { status: 500 });
    }
  }

  // Customer and other events: not ours. Acknowledged so Paystack does not retry them.
  if (!event.startsWith("transfer.")) return Response.json({ received: true });

  const data: TransferData = body.data && typeof body.data === "object" ? (body.data as TransferData) : {};
  const reference = typeof data.reference === "string" ? data.reference : "";
  const status = statusOf(event, data);
  if (!reference || !status) return Response.json({ received: true });

  try {
    const result = await applyTransferEvent({
      reference,
      status,
      transferCode: typeof data.transfer_code === "string" ? data.transfer_code : undefined,
      reason: failureReasonOf(data),
    });
    if (result.outcome === "updated" && result.payoutId) {
      const payoutId = result.payoutId;
      if (result.payoutStatus === "paid") {
        after(async () => {
          try {
            await notifyCommissionPaid(payoutId);
          } catch (e) {
            console.error("[paystack webhook] could not tell the partner the commission was paid", e);
          }
        });
      } else if (result.payoutStatus === "failed" || result.payoutStatus === "reversed") {
        after(async () => {
          try {
            await notifyPayoutFailed(payoutId);
          } catch (e) {
            console.error("[paystack webhook] could not alert managers to the failed payout", e);
          }
        });
      }
    }
  } catch (e) {
    console.error(`[paystack webhook] ${event} for ${reference} could not be applied`, e);
    return Response.json({ received: false }, { status: 500 });
  }
  return Response.json({ received: true });
}

/** Paystack only ever POSTs; anything else is a browser or a crawler. */
export function GET() {
  return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
}
