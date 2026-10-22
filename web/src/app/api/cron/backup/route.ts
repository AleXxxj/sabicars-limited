import { runBackup } from "@/lib/backup";
import { fromScheduler } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The weekly backup. Schedule it for Sundays at 02:00 UTC (03:00 in Lagos),
 * with the header `Authorization: Bearer <CRON_SECRET>` (docs/LAUNCH.md).
 * Safe to re-run: a second run the same day simply stores a second copy.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const result = await runBackup();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
