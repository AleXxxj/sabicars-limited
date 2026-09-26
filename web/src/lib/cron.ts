import "server-only";
import { timingSafeEqual } from "node:crypto";

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
