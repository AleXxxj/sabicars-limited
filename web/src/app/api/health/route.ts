import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Is the site up, and can it reach its database? For the uptime monitor,
 * which calls this every minute and alerts the owner when it does not get
 * 200 (docs/LAUNCH.md). The answer carries the commit it is running, so a
 * deploy check can confirm which version is live.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "down" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "down";
  }
  const body = {
    ok: database === "ok",
    database,
    databaseMs: Date.now() - started,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    at: new Date().toISOString(),
  };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
