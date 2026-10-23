import { escalateStaleLeads } from "@/lib/alerts";
import { answerInTime, fromScheduler } from "@/lib/cron";

/**
 * The escalation sweep on a timer, for the quiet stretches when no new
 * enquiry or inbox visit would trigger it. Every 5 minutes.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  return answerInTime("/api/cron/escalate", escalateStaleLeads(), (escalated) => Response.json({ ok: true, escalated }));
}
