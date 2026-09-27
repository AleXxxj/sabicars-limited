import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogComments, blogPosts, type BlogPost } from "@/db/schema";
import { readingMinutes } from "@/lib/blog/blocks";
import { sabicarsDealerId } from "@/lib/leads";
import { hummerBuses, listedVehicles, searchTerms, toCard, vehiclesBySlugs, vehiclesForTerm, type CardVehicle } from "@/lib/repositories/vehicles";

export interface PostCard {
  slug: string;
  title: string;
  category: string;
  standfirst: string;
  coverImageUrl: string | null;
  author: string;
  publishedAt: Date;
  minutes: number;
  views: number;
  isFeatured: boolean;
}

const toPostCard = (p: BlogPost): PostCard => ({
  slug: p.slug,
  title: p.title,
  category: p.category,
  standfirst: p.standfirst || p.excerpt,
  coverImageUrl: p.coverImageUrl,
  author: p.author,
  publishedAt: p.publishedAt ?? p.createdAt,
  minutes: p.blocks.length ? readingMinutes(p.blocks) : (p.readMinutes ?? 3),
  views: p.views,
  isFeatured: p.isFeatured,
});

const published = async () => and(eq(blogPosts.dealerId, await sabicarsDealerId()), eq(blogPosts.isPublished, true));

/** Every published article, featured first, then newest. */
export const publishedPosts = cache(async (): Promise<PostCard[]> => {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(await published())
    .orderBy(desc(blogPosts.isFeatured), desc(blogPosts.publishedAt));
  return rows.map(toPostCard);
});

export async function latestPosts(limit = 3): Promise<PostCard[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(await published())
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);
  return rows.map(toPostCard);
}

export const postBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(await published(), eq(blogPosts.slug, slug)))
    .limit(1);
  return row ?? null;
});

/** Same category first, then the newest of the rest — never the article itself. */
export async function relatedPosts(post: BlogPost, limit = 3): Promise<PostCard[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(await published(), ne(blogPosts.id, post.id)))
    .orderBy(sql`${blogPosts.category} = ${post.category} DESC`, desc(blogPosts.publishedAt))
    .limit(limit);
  return rows.map(toPostCard);
}

export async function approvedComments(postId: string) {
  return db
    .select({ id: blogComments.id, name: blogComments.name, message: blogComments.message, createdAt: blogComments.createdAt })
    .from(blogComments)
    .where(and(eq(blogComments.postId, postId), eq(blogComments.isApproved, true)))
    .orderBy(asc(blogComments.createdAt));
}

/**
 * The cars an article's "cars" block shows: chosen vehicles, or everything in
 * stock for a search term ("hummer-bus", "toyota-highlander"). Always live —
 * an article never advertises a car that has gone.
 */
export async function carsForBlock(b: { term?: string; slugs?: string[]; body?: string; limit?: number }): Promise<CardVehicle[]> {
  const limit = b.limit ?? 3;
  if (b.body) return (await listedVehicles()).filter((v) => v.body === b.body).map(toCard).slice(0, limit);
  if (b.slugs?.length) {
    return (await vehiclesBySlugs(b.slugs))
      .map(toCard)
      .filter((c) => c.status === "available" || c.status === "reserved")
      .slice(0, limit);
  }
  if (!b.term) return [];
  if (b.term === "hummer-bus")
    return (await hummerBuses())
      .filter((v) => /hum+er/i.test(v.model))
      .map(toCard)
      .slice(0, limit);
  const term = (await searchTerms()).find((t) => t.slug === b.term);
  return term ? (await vehiclesForTerm(term)).map(toCard).slice(0, limit) : [];
}

/* ── Staff ─────────────────────────────────────────────────────────────── */

export async function adminPosts(dealerId: string) {
  return db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      category: blogPosts.category,
      isPublished: blogPosts.isPublished,
      isFeatured: blogPosts.isFeatured,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      views: blogPosts.views,
      shares: blogPosts.shares,
      reactions: blogPosts.reactions,
    })
    .from(blogPosts)
    .where(eq(blogPosts.dealerId, dealerId))
    .orderBy(desc(blogPosts.isPublished), desc(blogPosts.updatedAt));
}

export async function adminPost(dealerId: string, id: string): Promise<BlogPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.dealerId, dealerId), eq(blogPosts.id, id)))
    .limit(1);
  return row ?? null;
}

export async function pendingComments(dealerId: string) {
  return db
    .select({
      id: blogComments.id,
      name: blogComments.name,
      message: blogComments.message,
      createdAt: blogComments.createdAt,
      post: blogPosts.title,
      slug: blogPosts.slug,
    })
    .from(blogComments)
    .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
    .where(and(eq(blogPosts.dealerId, dealerId), isNull(blogComments.reviewedAt)))
    .orderBy(desc(blogComments.createdAt));
}

export async function pendingCommentCount(dealerId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(blogComments)
    .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
    .where(and(eq(blogPosts.dealerId, dealerId), isNull(blogComments.reviewedAt)));
  return n;
}
