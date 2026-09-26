import { fromScheduler } from "@/lib/cron";
import { sabicarsDealerId } from "@/lib/leads";
import { runWeeklyDigest } from "@/lib/newsletter";

/**
 * The weekly new-arrivals email. Scheduled for Friday 8:00 UTC (9:00 in
 * Lagos); running it twice in a week sends once.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const result = await runWeeklyDigest(await sabicarsDealerId());
  return Response.json({ ok: true, ...result });
}
