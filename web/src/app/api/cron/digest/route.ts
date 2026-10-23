import { answerInTime, fromScheduler } from "@/lib/cron";
import { sabicarsDealerId } from "@/lib/leads";
import { runWeeklyDigest } from "@/lib/newsletter";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The weekly new-arrivals email. Scheduled for Friday 8:00 UTC (9:00 in
 * Lagos); running it twice in a week sends once. A large list (a hundred
 * recipients per request, paced under Resend's limit) can outlast the
 * scheduler's 30 seconds: it answers 202 then and finishes in the background.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const work = sabicarsDealerId().then((dealerId) => runWeeklyDigest(dealerId));
  return answerInTime("/api/cron/digest", work, (result) => Response.json({ ok: true, ...result }));
}
