import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { vehicleRequests } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";

/** Below this many open requests the list says more about the sample than the market, so it is not shown. */
const MIN_OPEN_REQUESTS = 3;

/**
 * What buyers are asking the Sourcing Desk for right now, most-requested
 * first. Public proof that the desk is used, and — for staff — a sourcing
 * list. Only the vehicle is shown, never who asked.
 */
export async function mostRequested(limit = 5): Promise<{ want: string; requests: number }[]> {
  const dealerId = await sabicarsDealerId();
  const open = and(eq(vehicleRequests.dealerId, dealerId), eq(vehicleRequests.status, "open"));
  const [{ total }] = await db.select({ total: count() }).from(vehicleRequests).where(open);
  if (total < MIN_OPEN_REQUESTS) return [];

  const key = sql<string>`lower(btrim(${vehicleRequests.want}))`;
  const rows = await db
    .select({ key, want: sql<string>`min(btrim(${vehicleRequests.want}))`, requests: count() })
    .from(vehicleRequests)
    .where(open)
    .groupBy(key)
    .orderBy(desc(count()), key)
    .limit(limit);
  return rows.map(({ want, requests }) => ({ want, requests }));
}
