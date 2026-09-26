import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { notifications, vehicleMedia, vehicles } from "@/db/schema";
import { shareImageUrl } from "@/lib/media";
import { formatNaira } from "@/lib/money";
import { siteUrl } from "@/lib/site";
import { drivePlanDeposit, vehicleTitle } from "@/lib/vehicle";

/**
 * The notification bell and its push alerts, running themselves.
 *
 * On the old site staff typed every "New arrival 🔥" by hand. Here listing a
 * car posts it, cutting a price posts it, and each post is pushed to everyone
 * who turned alerts on — through the same OneSignal account, so every existing
 * subscriber keeps receiving them. Staff can still post an offer by hand.
 */

export function oneSignalConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
}

/** Sends a push to every OneSignal subscriber. */
export async function pushToSubscribers(n: {
  id: string;
  title: string;
  message: string;
  url: string;
  imageUrl?: string | null;
}): Promise<{ ok: true; recipients: number | null } | { ok: false; error: string }> {
  if (!oneSignalConfigured()) return { ok: false, error: "not_configured" };
  const key = process.env.ONESIGNAL_REST_API_KEY!;
  try {
    const res = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Keys issued since late 2024 start "os_v2_" and use the Key scheme; older ones use Basic.
        Authorization: key.startsWith("os_v2_") ? `Key ${key}` : `Basic ${key}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        // The segment the old site settled on after testing (legacy commit bbe3449).
        included_segments: ["Total Subscriptions"],
        target_channel: "push",
        headings: { en: n.title },
        contents: { en: n.message.slice(0, 180) },
        url: n.url,
        chrome_web_image: n.imageUrl ?? undefined,
        // The same notification is never delivered twice, even if this call is retried.
        idempotency_key: n.id,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; recipients?: number; errors?: unknown };
    if (!res.ok || body.errors)
      return { ok: false, error: `OneSignal ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 200)}` };
    return { ok: true, recipients: typeof body.recipients === "number" ? body.recipients : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface NewNotification {
  dealerId: string;
  title: string;
  message: string;
  kind: "arrival" | "price_drop" | "blog" | "offer" | "system";
  link: string | null;
  vehicleId?: string | null;
  imageUrl?: string | null;
  /** Makes an automatic post happen once: "arrival:<vehicle>", "price:<vehicle>:<kobo>". */
  eventKey?: string | null;
  createdBy?: string | null;
  push: boolean;
}

/** Posts to the bell and, if asked, pushes it. Returns null when the event was already posted. */
export async function postNotification(n: NewNotification): Promise<{ id: string; pushed: boolean; pushError: string | null } | null> {
  const [row] = await db
    .insert(notifications)
    .values({
      dealerId: n.dealerId,
      title: n.title,
      message: n.message,
      kind: n.kind,
      link: n.link,
      vehicleId: n.vehicleId ?? null,
      imageUrl: n.imageUrl ?? null,
      eventKey: n.eventKey ?? null,
      createdBy: n.createdBy ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!row) return null;
  if (!n.push) return { id: row.id, pushed: false, pushError: null };

  const result = await pushToSubscribers({
    id: row.id,
    title: n.title,
    message: n.message,
    url: n.link ? new URL(n.link, siteUrl()).href : siteUrl(),
    imageUrl: n.imageUrl,
  });
  await db
    .update(notifications)
    .set(result.ok ? { pushedAt: new Date(), pushRecipients: result.recipients, pushError: null } : { pushError: result.error })
    .where(eq(notifications.id, row.id));
  return { id: row.id, pushed: result.ok, pushError: result.ok ? null : result.error };
}

async function vehicleWithCover(vehicleId: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v) return null;
  const [cover] = await db
    .select({ url: vehicleMedia.url })
    .from(vehicleMedia)
    .where(and(eq(vehicleMedia.vehicleId, v.id), eq(vehicleMedia.position, 0)))
    .limit(1);
  return { v, cover: cover?.url ?? null };
}

/** How recently a vehicle must have been listed to count as a new arrival. */
const ARRIVAL_WINDOW_MS = 7 * 86_400_000;

/**
 * "New arrival" — once per vehicle, when it is available and has its first
 * photo (a push without a picture sells nothing). Vehicles listed more than a
 * week ago, and any the old site already announced, are not new arrivals.
 */
export async function announceArrival(vehicleId: string): Promise<boolean> {
  const found = await vehicleWithCover(vehicleId);
  if (!found) return false;
  const { v, cover } = found;
  if (v.status !== "available" || !cover || !v.publishedAt || Date.now() - v.publishedAt.getTime() > ARRIVAL_WINDOW_MS) return false;
  const [earlier] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.vehicleId, v.id), gte(notifications.createdAt, new Date(Date.now() - 90 * 86_400_000))))
    .limit(1);
  if (earlier) return false;

  const title = vehicleTitle(v);
  const deposit = drivePlanDeposit(v);
  const posted = await postNotification({
    dealerId: v.dealerId,
    title: `New arrival: ${title}`,
    message: [
      v.priceMinor ? formatNaira(v.priceMinor) : "Price on request",
      deposit ? `${deposit} down on the 40% Drive Plan` : null,
      "In the showroom now.",
    ]
      .filter(Boolean)
      .join(" · "),
    kind: "arrival",
    link: `/vehicles/${v.slug}`,
    vehicleId: v.id,
    imageUrl: shareImageUrl(cover),
    eventKey: `arrival:${v.id}`,
    push: true,
  });
  return Boolean(posted);
}

/** "Price drop" — when a listed vehicle's price falls. Each new price is announced once. */
export async function announcePriceCut(vehicleId: string, previousMinor: number | null): Promise<boolean> {
  const found = await vehicleWithCover(vehicleId);
  if (!found) return false;
  const { v, cover } = found;
  if (v.status !== "available" || !v.priceMinor || !previousMinor || v.priceMinor >= previousMinor) return false;
  const title = vehicleTitle(v);
  const posted = await postNotification({
    dealerId: v.dealerId,
    title: `Price drop: ${title}`,
    message: `Now ${formatNaira(v.priceMinor)}, down from ${formatNaira(previousMinor)}.`,
    kind: "price_drop",
    link: `/vehicles/${v.slug}`,
    vehicleId: v.id,
    imageUrl: cover ? shareImageUrl(cover) : null,
    eventKey: `price:${v.id}:${v.priceMinor}`,
    push: true,
  });
  return Boolean(posted);
}
