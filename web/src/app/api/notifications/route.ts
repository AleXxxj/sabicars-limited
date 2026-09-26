import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, vehicleMedia } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";
import { shareImageUrl } from "@/lib/media";

/**
 * Old posts were written for Instagram — a shouted first line ("🔥 NEW
 * ARRIVAL! 🔥"), then the substance. The feed shows the first line that says
 * something: one with ordinary lowercase words in it.
 */
function summary(message: string): string {
  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const said = lines.find((l) => (l.match(/[a-z]/g) ?? []).length >= 12) ?? lines[0] ?? "";
  return said.length > 200 ? `${said.slice(0, 197).trimEnd()}…` : said;
}

/**
 * The bell's feed: the latest 20 posts. Fetched by the browser after the page
 * has drawn, and cached at the edge for 30 seconds, so the feed is fresh
 * without every page view reaching the database.
 */
export async function GET() {
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      kind: notifications.kind,
      link: notifications.link,
      imageUrl: notifications.imageUrl,
      cover: vehicleMedia.url,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(vehicleMedia, and(eq(vehicleMedia.vehicleId, notifications.vehicleId), eq(vehicleMedia.position, 0)))
    .where(eq(notifications.dealerId, await sabicarsDealerId()))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: summary(r.message),
    kind: r.kind,
    // Only this site's own pages: a feed item never sends a visitor somewhere unexpected.
    link: r.link?.startsWith("/") ? r.link : null,
    image: r.imageUrl ?? (r.cover ? shareImageUrl(r.cover) : null),
    at: r.createdAt.toISOString(),
  }));
  return Response.json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
