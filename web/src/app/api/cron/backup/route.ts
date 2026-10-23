import { runBackup } from "@/lib/backup";
import { answerInTime, fromScheduler } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The weekly backup. Schedule it for Sundays at 02:00 UTC (03:00 in Lagos),
 * with the header `Authorization: Bearer <CRON_SECRET>` (docs/LAUNCH.md).
 * Safe to re-run: a second run the same day simply stores a second copy.
 * A backup that outgrows the scheduler's 30 seconds answers 202 and finishes
 * in the background; a failure still alerts the managers either way.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  return answerInTime("/api/cron/backup", runBackup(), (result) => Response.json(result, { status: result.ok ? 200 : 500 }));
}
