import "server-only";
import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { recordIncident } from "@/lib/incidents";

/**
 * Whether a request comes from the scheduler. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` itself; any other scheduler is given
 * the same header. Without the secret set, nothing is authorised.
 */
export function fromScheduler(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * cron-job.org's free plan waits 30 seconds for an answer, then records the
 * run as failed and closes the connection; after 25 failures in a row it
 * switches the job off. Five seconds of margin for the network either side.
 */
const ANSWER_WITHIN_MS = 25_000;
const LATE = Symbol("late");

/**
 * Runs a scheduled job and answers the scheduler in time. A job that finishes
 * within 25 seconds answers with its own result, so the scheduler's history
 * shows a real failure as a failure. One still running then (a backup or a
 * digest that has grown with the business) answers 202 and finishes in the
 * background, up to the route's `maxDuration`; an error after that point is
 * put on /admin/status#errors, where the managers are alerted to it.
 */
export async function answerInTime<T>(path: string, work: Promise<T>, respond: (result: T) => Response): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(() => resolve(LATE), ANSWER_WITHIN_MS);
  });
  const first = await Promise.race([work, late]).finally(() => clearTimeout(timer));
  if (first !== LATE) return respond(first);
  after(
    work.then(
      () => undefined,
      (e) =>
        recordIncident({
          kind: "server",
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? (e.stack ?? null) : null,
          path,
          method: "GET",
        }),
    ),
  );
  return Response.json({ ok: true, running: true }, { status: 202 });
}
