import { db } from "@/db";
import { settings } from "@/db/schema";
import { alertManagers } from "@/lib/alerts";
import { answerInTime, fromScheduler } from "@/lib/cron";
import { sabicarsDealerId } from "@/lib/leads";
import { payableCount, reconcileProcessingPayouts } from "@/lib/ledger";
import { notifyCommissionPaid, notifyPayoutFailed } from "@/lib/ledger-notify";

/**
 * The daily payouts check. Schedule it for 07:00 Lagos (06:00 UTC), with the
 * header `Authorization: Bearer <CRON_SECRET>` (docs/LAUNCH.md).
 *
 * Two jobs. First, every Paystack transfer still in flight is checked against
 * Paystack, a safety net for a webhook that never arrived. Then, if any
 * commission has passed its cooling-off and is waiting to be paid, the owner
 * and managers are told, once a day, however many times this runs: the
 * day's alert is claimed in the settings table before it is sent.
 *
 * Safe to re-run: a second run the same day checks again and alerts nobody.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  return answerInTime("/api/cron/payouts", checkPayouts(), (result) => Response.json({ ok: true, ...result }));
}

async function checkPayouts(): Promise<{ checked: number; updated: number; payable: number }> {
  const dealerId = await sabicarsDealerId();
  const { checked, updated, settled } = await reconcileProcessingPayouts(dealerId);
  // A transfer that settled here, with no webhook, still tells the partner or the managers.
  for (const s of settled) {
    if (s.status === "paid") await notifyCommissionPaid(s.payoutId);
    else if (s.status === "failed" || s.status === "reversed") await notifyPayoutFailed(s.payoutId);
  }
  const payable = await payableCount(dealerId);

  if (payable > 0) {
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
    const key = `payouts_alert:${day}`;
    // Claim today's alert before sending it: of two runs at the same moment, only one gets the row.
    const claimed = await db
      .insert(settings)
      .values({ dealerId, key, value: { at: now.toISOString(), payable } })
      .onConflictDoNothing()
      .returning({ key: settings.key });
    if (claimed.length) {
      const n = payable === 1 ? "1 commission" : `${payable} commissions`;
      await alertManagers(dealerId, {
        title: `${payable} commission${payable === 1 ? "" : "s"} ready to pay`,
        body: `${n} ${payable === 1 ? "has" : "have"} passed the 48-hour cooling-off and ${payable === 1 ? "is" : "are"} waiting to be paid to ${payable === 1 ? "a partner" : "partners"}. Pay by Paystack transfer, or record a bank transfer, on the payouts page.`,
        url: "/admin/payouts",
        tag: "payouts",
        action: "Open payouts",
      });
    }
  }

  return { checked, updated, payable };
}
