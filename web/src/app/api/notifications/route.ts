import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, vehicleMedia, vehicles } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";
import { shareImageUrl } from "@/lib/media";
import { HAS_PAGE } from "@/lib/repositories/vehicles";

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

  // A post about a car outlives the car: once it is taken down, its page answers 404, and a feed
  // item must never lead a visitor there. The link stays only while the car still has a page.
  const slugOf = (link: string | null) => link?.match(/^\/vehicles\/([a-z0-9-]+)$/)?.[1];
  const carSlugs = rows.map((r) => slugOf(r.link)).filter((s): s is string => Boolean(s));
  const carBySlug = new Map(
    carSlugs.length
      ? (
          await db
            .select({ slug: vehicles.slug, year: vehicles.year, make: vehicles.make, model: vehicles.model })
            .from(vehicles)
            .where(and(inArray(vehicles.slug, carSlugs), inArray(vehicles.status, [...HAS_PAGE])))
        ).map((v) => [v.slug, v] as const)
      : [],
  );
  const stillThere = (link: string | null) => {
    if (!link?.startsWith("/")) return null;
    const slug = slugOf(link);
    return slug && !carBySlug.has(slug) ? null : link;
  };
  // The headline and the car it opens come from the same record. Old posts were typed by hand, and one
  // announced a "C300s" that opened a GLC 300 (audit, 8 November 2026): when a post's headline does not
  // name the car at its link, the car's own name is the headline.
  const headline = (title: string, link: string | null) => {
    const car = carBySlug.get(slugOf(link) ?? "");
    if (!car || title.toLowerCase().includes(car.model.toLowerCase())) return title;
    const name = `${car.year} ${car.make} ${car.model}`;
    return /arriv/i.test(title) ? `New arrival: ${name}` : name;
  };

  const items = rows.map((r) => ({
    id: r.id,
    title: headline(r.title, r.link),
    message: summary(r.message),
    kind: r.kind,
    // Only this site's own pages, and only pages that still answer.
    link: stillThere(r.link),
    image: r.imageUrl ?? (r.cover ? shareImageUrl(r.cover) : null),
    at: r.createdAt.toISOString(),
  }));
  return Response.json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
