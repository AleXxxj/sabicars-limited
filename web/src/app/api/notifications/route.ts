import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, vehicleMedia, vehicles } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";
import { shareImageUrl } from "@/lib/media";
import { HAS_PAGE, LISTED } from "@/lib/repositories/vehicles";

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
  const dealerId = await sabicarsDealerId();
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
    .where(eq(notifications.dealerId, dealerId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  // A post about a car outlives the car. While the car still has a page, the post opens it. Once the car is
  // no longer listed (its page answers 404), the post says so and opens that make's cars for sale, or, when
  // none is left, the request form already filled in, so a buyer who liked it has somewhere to go (audits,
  // 8 and 9 November 2026: a corrected GLC 300 post "still led nowhere"). "No longer listed", not "sold":
  // a car is also hidden while the team checks it.
  const slugOf = (link: string | null) => link?.match(/^\/vehicles\/([a-z0-9-]+)$/)?.[1];
  const carSlugs = rows.map((r) => slugOf(r.link)).filter((s): s is string => Boolean(s));
  const carBySlug = new Map(
    carSlugs.length
      ? (
          await db
            .select({ slug: vehicles.slug, year: vehicles.year, make: vehicles.make, model: vehicles.model, status: vehicles.status })
            .from(vehicles)
            .where(and(eq(vehicles.dealerId, dealerId), inArray(vehicles.slug, carSlugs)))
        ).map((v) => [v.slug, v] as const)
      : [],
  );
  const hasPage = (status: string) => (HAS_PAGE as readonly string[]).includes(status);
  const goneMakes = [...new Set([...carBySlug.values()].filter((c) => !hasPage(c.status)).map((c) => c.make))];
  const makesForSale = new Set(
    goneMakes.length
      ? (
          await db
            .selectDistinct({ make: vehicles.make })
            .from(vehicles)
            .where(and(eq(vehicles.dealerId, dealerId), inArray(vehicles.status, [...LISTED]), inArray(vehicles.make, goneMakes)))
        ).map((r) => r.make)
      : [],
  );
  const carOf = (link: string | null) => carBySlug.get(slugOf(link) ?? "");
  const where = (link: string | null) => {
    // Only this site's own pages ("//elsewhere" is another site).
    if (!link || !/^\/(?!\/)/.test(link)) return null;
    const slug = slugOf(link);
    if (!slug) return link;
    const car = carBySlug.get(slug);
    if (!car) return "/vehicles";
    if (hasPage(car.status)) return link;
    return makesForSale.has(car.make)
      ? `/vehicles?make=${encodeURIComponent(car.make)}`
      : `/find?want=${encodeURIComponent(`${car.make} ${car.model}`)}`;
  };
  const note = (link: string | null) => {
    if (!slugOf(link)) return null;
    const car = carOf(link);
    if (!car) return "No longer listed. See the cars for sale now.";
    if (hasPage(car.status)) return null;
    return makesForSale.has(car.make) ? `No longer listed. See the ${car.make} cars for sale now.` : "No longer listed. Tell us and we will find one like it.";
  };
  // The headline and the car it opens come from the same record. Old posts were typed by hand, and one
  // announced a "C300s" that opened a GLC 300 (audit, 8 November 2026): when a post's headline does not
  // name the car at its link, the car's own name is the headline.
  const headline = (title: string, link: string | null) => {
    const car = carOf(link);
    if (!car || title.toLowerCase().includes(car.model.toLowerCase())) return title;
    const name = `${car.year} ${car.make} ${car.model}`;
    return /arriv/i.test(title) ? `New arrival: ${name}` : name;
  };

  const items = rows.map((r) => ({
    id: r.id,
    title: headline(r.title, r.link),
    message: summary(r.message),
    kind: r.kind,
    link: where(r.link),
    note: note(r.link),
    image: r.imageUrl ?? (r.cover ? shareImageUrl(r.cover) : null),
    at: r.createdAt.toISOString(),
  }));
  return Response.json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
