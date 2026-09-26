import "server-only";
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSends, notifications, staff, subscribers, vehicles, type NewsletterSend, type Notification } from "@/db/schema";

export async function audienceSummary(
  dealerId: string,
): Promise<{ active: number; joined30: number; unsubscribed: number; bySource: { source: string; n: number }[] }> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [[{ active }], [{ joined30 }], [{ unsubscribed }], bySource] = await Promise.all([
    db
      .select({ active: count() })
      .from(subscribers)
      .where(and(eq(subscribers.dealerId, dealerId), eq(subscribers.isActive, true))),
    db
      .select({ joined30: count() })
      .from(subscribers)
      .where(and(eq(subscribers.dealerId, dealerId), eq(subscribers.isActive, true), gte(subscribers.createdAt, since))),
    db
      .select({ unsubscribed: count() })
      .from(subscribers)
      .where(and(eq(subscribers.dealerId, dealerId), eq(subscribers.isActive, false))),
    db
      .select({ source: subscribers.source, n: count() })
      .from(subscribers)
      .where(and(eq(subscribers.dealerId, dealerId), eq(subscribers.isActive, true)))
      .groupBy(subscribers.source),
  ]);
  return {
    active,
    joined30,
    unsubscribed,
    bySource: bySource.map((r) => ({ source: r.source ?? "unknown", n: r.n })).sort((a, b) => b.n - a.n),
  };
}

export async function recentNotifications(dealerId: string, limit = 15): Promise<(Notification & { by: string | null })[]> {
  const rows = await db
    .select({ n: notifications, by: staff.fullName })
    .from(notifications)
    .leftJoin(staff, eq(staff.id, notifications.createdBy))
    .where(eq(notifications.dealerId, dealerId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.n, by: r.by }));
}

export async function recentSends(dealerId: string, limit = 10): Promise<NewsletterSend[]> {
  return db
    .select()
    .from(newsletterSends)
    .where(eq(newsletterSends.dealerId, dealerId))
    .orderBy(desc(newsletterSends.createdAt))
    .limit(limit);
}

export async function recentSubscribers(dealerId: string, limit = 25) {
  return db
    .select({
      email: subscribers.email,
      name: subscribers.name,
      source: subscribers.source,
      isActive: subscribers.isActive,
      createdAt: subscribers.createdAt,
    })
    .from(subscribers)
    .where(eq(subscribers.dealerId, dealerId))
    .orderBy(desc(subscribers.createdAt))
    .limit(limit);
}

/** Vehicles an announcement can point to. */
export async function announceableVehicles(dealerId: string): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({ id: vehicles.id, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(and(eq(vehicles.dealerId, dealerId), inArray(vehicles.status, ["available", "reserved"])))
    .orderBy(asc(vehicles.make), asc(vehicles.model), desc(vehicles.year));
  return rows.map((r) => ({ id: r.id, label: `${r.year} ${r.make} ${r.model}` }));
}
