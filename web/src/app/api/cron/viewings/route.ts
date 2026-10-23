import { answerInTime, fromScheduler } from "@/lib/cron";
import { remindTodaysViewings } from "@/lib/viewing-reminders";

/**
 * The morning of a viewing day: buyers reminded by email, staff sent the day's
 * list. Daily at 06:30 UTC (07:30 in Lagos), before the showroom opens. Safe
 * to run more than once: nothing is sent twice.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  return answerInTime("/api/cron/viewings", remindTodaysViewings(), (result) => Response.json({ ok: true, ...result }));
}
