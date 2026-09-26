"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blogComments, blogPosts } from "@/db/schema";
import { notifyManagers } from "@/lib/alerts";
import { isReaction, type Reaction } from "@/lib/blog/reactions";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";

const slugOk = (s: string) => /^[a-z0-9-]{1,160}$/.test(s);

async function publishedPostId(slug: string): Promise<string | null> {
  if (!slugOk(slug)) return null;
  const [row] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.dealerId, await sabicarsDealerId()), eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * A reaction. Anonymous, like the old site's; the browser remembers it gave
 * one so a reader cannot pile up reactions by tapping.
 */
export async function react(slug: string, reaction: Reaction, undo = false): Promise<{ ok: boolean; reactions?: Record<string, number> }> {
  if (!isReaction(reaction)) return { ok: false };
  const id = await publishedPostId(slug);
  if (!id) return { ok: false };
  const delta = undo ? -1 : 1;
  const [row] = await db
    .update(blogPosts)
    .set({
      reactions: sql`jsonb_set(${blogPosts.reactions}, ${`{${reaction}}`}::text[], to_jsonb(greatest(0, coalesce((${blogPosts.reactions} ->> ${reaction})::int, 0) + ${delta})))`,
    })
    .where(eq(blogPosts.id, id))
    .returning({ reactions: blogPosts.reactions });
  return { ok: true, reactions: row.reactions };
}

export async function recordShare(slug: string): Promise<void> {
  const id = await publishedPostId(slug);
  if (id)
    await db
      .update(blogPosts)
      .set({ shares: sql`${blogPosts.shares} + 1` })
      .where(eq(blogPosts.id, id));
}

/** A read, counted once per visit by the page (the browser keeps the note). */
export async function recordView(slug: string): Promise<void> {
  const id = await publishedPostId(slug);
  if (id)
    await db
      .update(blogPosts)
      .set({ views: sql`${blogPosts.views} + 1` })
      .where(eq(blogPosts.id, id));
}

export interface CommentResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
}

const commentSchema = z.object({
  slug: z.string(),
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  message: z.string().trim().min(3, "Write a little more").max(1500, "Keep it under 1,500 characters"),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/** A comment. Like a review, it appears once someone at Sabicars has read it. */
export async function submitComment(_prev: CommentResult | null, formData: FormData): Promise<CommentResult> {
  const values = { name: String(formData.get("name") ?? ""), message: String(formData.get("message") ?? "") };
  const parsed = commentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
    return { ok: false, fieldErrors: { name: fe.name?.[0], message: fe.message?.[0] }, values };
  }
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true };
  const postId = await publishedPostId(v.slug);
  if (!postId) return { ok: false, error: "This article is no longer published." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(blogComments)
      .where(and(eq(blogComments.ipHash, ipHash), gte(blogComments.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= 5) return { ok: false, error: "Several comments came from this connection in the last hour. Please try again later.", values };
  }

  await db.insert(blogComments).values({ postId, name: v.name, message: v.message, ipHash });
  const dealerId = await sabicarsDealerId();
  after(() =>
    notifyManagers(dealerId, {
      title: `New comment from ${v.name}`,
      body: "It is waiting to be read before it appears under the article.",
      url: "/admin/blog",
      tag: "comments",
    }).catch((e) => console.error("[blog] comment alert failed", e)),
  );
  return { ok: true };
}
