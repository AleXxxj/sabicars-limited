import { reviewConversations } from "@/lib/assistant/learn";
import { pruneConversations } from "@/lib/assistant/vault";
import { answerInTime, fromScheduler } from "@/lib/cron";
import { sabicarsDealerId } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The assistant's weekly lesson: Mondays at 06:00 UTC (07:00 in Lagos), it
 * reads the week's chats and files a report for the owner on /admin/ask,
 * then removes conversations quiet for a year. Running it twice files two
 * reports; the admin shows the newest.
 */
export async function GET(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const work = (async () => {
    const result = await reviewConversations(await sabicarsDealerId());
    const pruned = await pruneConversations();
    return { ...result, pruned };
  })();
  return answerInTime("/api/cron/learn", work, (result) => Response.json({ ok: true, ...result }));
}
