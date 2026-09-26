import { timingSafeEqual } from "node:crypto";
import { escalateStaleLeads } from "@/lib/alerts";

/**
 * The escalation sweep on a timer, for the quiet stretches when no new
 * enquiry or inbox visit would trigger it. Any scheduler can call it — Vercel
 * Cron sends `Authorization: Bearer $CRON_SECRET` itself.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const escalated = await escalateStaleLeads();
  return Response.json({ ok: true, escalated });
}
