"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blogComments, blogPosts } from "@/db/schema";
import { notifyManagers } from "@/lib/alerts";
import { isReaction, type Reaction } from "@/lib/blog/reactions";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";

const slugOk = (s: string) => /^[a-z0-9-]{1,160}$/.test(s);

async function publishedPostId(slug: string): Promise<string | null> {
  if (!slugOk(slug)) return null;
  const known = postIds.get(slug);
  if (known && known.until > Date.now()) return known.id;
  const [row] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.dealerId, await sabicarsDealerId()), eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
    .limit(1);
  if (row) postIds.set(slug, { id: row.id, until: Date.now() + 5 * 60_000 });
  return row?.id ?? null;
}

/**
 * An article's id by its address, remembered for five minutes per server
 * instance: an article shared by the founder is opened thousands of times an
 * hour, and its id never changes. (An article unpublished in those five
 * minutes may still be counted a few times; nothing else is affected.)
 */
const postIds = new Map<string, { id: string; until: number }>();

/**
 * Reads not yet written, per article, in this server instance. A viral
 * article would otherwise be one database write per reader on the same row;
 * instead each instance adds up its reads and writes them once every ten
 * seconds. If an instance is stopped before its next write, those few
 * seconds of reads go uncounted — an acceptable trade for a reading counter.
 */
const pendingViews = new Map<string, number>();
let viewFlushScheduled = false;
const VIEW_FLUSH_MS = 10_000;

async function flushViews(): Promise<void> {
  const counts = [...pendingViews];
  pendingViews.clear();
  for (const [id, n] of counts) {
    try {
      await db
        .update(blogPosts)
        .set({ views: sql`${blogPosts.views} + ${n}` })
        .where(eq(blogPosts.id, id));
    } catch (e) {
      console.error("[blog] could not record views", e instanceof Error ? e.message : e);
    }
  }
}

/**
 * A reaction. Anonymous, like the old site's; the browser remembers it gave
 * one so a reader cannot pile up reactions by tapping, and the ceiling per
 * connection stops a script from doing it (silently: the count simply does
 * not move).
 */
export async function react(slug: string, reaction: Reaction, undo = false): Promise<{ ok: boolean; reactions?: Record<string, number> }> {
  if (!isReaction(reaction)) return { ok: false };
  const id = await publishedPostId(slug);
  if (!id) return { ok: false };
  if (!(await withinLimit("engage"))) return { ok: false };
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
  if (!id || !(await withinLimit("engage"))) return;
  await db
    .update(blogPosts)
    .set({ shares: sql`${blogPosts.shares} + 1` })
    .where(eq(blogPosts.id, id));
}

/** A read, counted once per visit by the page (the browser keeps the note), and written in batches (above). */
export async function recordView(slug: string): Promise<void> {
  const id = await publishedPostId(slug);
  if (!id) return;
  pendingViews.set(id, (pendingViews.get(id) ?? 0) + 1);
  if (viewFlushScheduled) return;
  viewFlushScheduled = true;
  // after(): the reply goes back at once; this instance stays up long enough to write the batch.
  after(async () => {
    await new Promise((r) => setTimeout(r, VIEW_FLUSH_MS));
    viewFlushScheduled = false;
    await flushViews();
  });
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

  // The shared ceiling per connection replaces the old five-an-hour count: on a widely shared article, five
  // comments an hour from one mobile-network address would have turned real readers away.
  if (!(await withinLimit("comment"))) return { ok: false, error: RATE_LIMITED_MESSAGE, values };

  // The address is still kept with the comment, hashed, so staff can see when several came from one place.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;

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
