import { answerInTime, fromScheduler } from "@/lib/cron";
import { releaseStaleRooms } from "@/lib/assistant/seller-room";
import { sealBacklog } from "@/lib/assistant/vault";
import { drainOutbox, pruneOutbox } from "@/lib/email";
import { expireReservations } from "@/lib/reserve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends the emails waiting in the outbox. Schedule it every minute with the
 * header `Authorization: Bearer <CRON_SECRET>` (docs/LAUNCH.md). Each run
 * tries up to 600 emails — six batches of 100 at Resend's pace — and stops
 * starting batches after 20 seconds, or early when Resend is busy; the next
 * minute carries on. Safe to run twice at once: each email is claimed by
 * exactly one run.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const work = (async () => {
    const result = await drainOutbox(600);
    // Once an hour is plenty for housekeeping; the first run of each hour does it (or a run asked for it by hand).
    const hourly = new Date().getUTCMinutes() === 0 || new URL(request.url).searchParams.get("housekeeping") === "1";
    const pruned = hourly ? await pruneOutbox() : 0;
    // Chat messages written before the chat key existed are sealed, a batch an hour, until none are left.
    const sealed = hourly ? await sealBacklog() : 0;
    // A seller chat whose buyer left before anyone answered stops waiting after a day.
    const released = hourly ? await releaseStaleRooms() : 0;
    if (released) console.log(`[outbox] ${released} stale chat room${released === 1 ? "" : "s"} released`);
    // A deposit's hold that has run out puts the car back on offer and tells the managers.
    const expired = hourly ? await expireReservations() : 0;
    if (expired) console.log(`[outbox] ${expired} reservation hold${expired === 1 ? "" : "s"} ran out`);
    return { ...result, pruned, sealed, released, expired };
  })();
  return answerInTime("/api/cron/outbox", work, (result) => Response.json({ ok: true, ...result }));
}
