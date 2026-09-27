import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, vehicles } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";

/**
 * The two old pages whose address carried an id: car-detail.html?id=<legacy id>
 * and blog-post.html?slug=<slug>. Each answers with one permanent redirect to
 * the new page — or, for a car or post that is gone, to the list it belonged
 * to, never a dead end. Permanent, so search engines move the old page's
 * standing to the new one.
 */
function to(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 301);
}

export async function carDetail(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{24}$/i.test(id)) return to(request, "/vehicles");
  const [car] = await db
    .select({ slug: vehicles.slug })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.dealerId, await sabicarsDealerId()),
        eq(vehicles.legacyId, id),
        inArray(vehicles.status, ["available", "reserved", "sold"]),
      ),
    )
    .limit(1);
  return to(request, car ? `/vehicles/${car.slug}` : "/vehicles");
}

export async function blogPost(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get("slug") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!slug) return to(request, "/blog");
  const [post] = await db
    .select({ slug: blogPosts.slug })
    .from(blogPosts)
    .where(and(eq(blogPosts.dealerId, await sabicarsDealerId()), eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
    .limit(1);
  return to(request, post ? `/blog/${post.slug}` : "/blog");
}
