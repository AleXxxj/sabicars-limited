import { fromScheduler } from "@/lib/cron";
import { drainOutbox, pruneOutbox } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends the emails waiting in the outbox. Schedule it every minute with the
 * header `Authorization: Bearer <CRON_SECRET>` (docs/LAUNCH.md). Each run
 * tries up to 600 emails — six batches of 100 at Resend's pace — and stops
 * early when Resend is busy; the next minute carries on. Safe to run twice at
 * once: each email is claimed by exactly one run.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const result = await drainOutbox(600);
  // Once an hour is plenty for housekeeping; the first run of each hour does it.
  const pruned = new Date().getUTCMinutes() === 0 ? await pruneOutbox() : 0;
  return Response.json({ ok: true, ...result, pruned });
}
