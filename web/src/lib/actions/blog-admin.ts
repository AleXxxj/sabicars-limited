"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blogComments, blogPosts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireStaff, type StaffMember } from "@/lib/auth";
import { blocksSchema, plainText } from "@/lib/blog/blocks";
import { isGenuineUpload, uploadTicket, type UploadedAsset, type UploadTicket } from "@/lib/cloudinary";
import { shareImageUrl } from "@/lib/media";
import { createArticleSend, deliver } from "@/lib/newsletter";
import { postNotification } from "@/lib/notifications";
import { slugPart } from "@/lib/seo/search-terms";

type Result = { ok: boolean; error?: string };

async function editor(): Promise<StaffMember> {
  const me = await requireStaff();
  if (me.role === "sales") throw new Error("Only a manager can edit articles.");
  return me;
}

function refresh(slug?: string) {
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/blog", "layout");
}

const postSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(8, "Give it a headline").max(140),
  standfirst: z.string().trim().min(20, "Write the hook line under the headline").max(320),
  category: z.string().trim().min(2).max(40),
  coverImageUrl: z.preprocess((v) => (v === "" ? null : v), z.url().startsWith("https://").nullable()),
  coverVideoUrl: z.preprocess((v) => (v === "" ? null : v), z.url().startsWith("https://").nullable()),
  tags: z.array(z.string().trim().max(60)).max(10),
  blocks: blocksSchema.min(1, "An article needs at least one paragraph"),
});

export type PostInput = z.input<typeof postSchema>;

/** Saves an article. A new one gets its address from the headline; a published one keeps its address for good. */
export async function savePost(input: PostInput): Promise<Result & { id?: string; issues?: string[] }> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some parts need attention.",
      issues: parsed.error.issues
        .slice(0, 8)
        .map((i) => (i.path[0] === "blocks" ? `Block ${Number(i.path[1]) + 1}: ${i.message}` : `${String(i.path[0])}: ${i.message}`)),
    };
  }
  const v = parsed.data;
  const values = {
    title: v.title,
    standfirst: v.standfirst,
    excerpt: v.standfirst || plainText(v.blocks, 200),
    category: v.category,
    coverImageUrl: v.coverImageUrl,
    coverVideoUrl: v.coverVideoUrl,
    tags: v.tags,
    blocks: v.blocks,
    updatedAt: new Date(),
  };

  if (v.id) {
    const [before] = await db
      .select({ slug: blogPosts.slug, isPublished: blogPosts.isPublished })
      .from(blogPosts)
      .where(and(eq(blogPosts.id, v.id), eq(blogPosts.dealerId, me.dealerId)))
      .limit(1);
    if (!before) return { ok: false, error: "That article no longer exists." };
    await db.update(blogPosts).set(values).where(eq(blogPosts.id, v.id));
    await audit(me, "blog_post", v.id, "update", { title: v.title });
    refresh(before.slug);
    return { ok: true, id: v.id };
  }

  const base = slugPart(v.title).slice(0, 80) || "article";
  let slug = base;
  for (let i = 2; ; i++) {
    const [taken] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.dealerId, me.dealerId), eq(blogPosts.slug, slug)))
      .limit(1);
    if (!taken) break;
    slug = `${base}-${i}`;
  }
  const [row] = await db
    .insert(blogPosts)
    .values({ ...values, dealerId: me.dealerId, slug, author: "Sabicars Team", isPublished: false })
    .returning({ id: blogPosts.id });
  await audit(me, "blog_post", row.id, "create", { title: v.title, slug });
  refresh();
  return { ok: true, id: row.id };
}

/**
 * Tells the audience about an article, once: on the bell and phones, and by
 * email to subscribers. Keyed on the article, so it can never go out twice.
 */
async function announce(me: StaffMember, id: string): Promise<{ bell: boolean; email: "sending" | "already" }> {
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), eq(blogPosts.dealerId, me.dealerId), eq(blogPosts.isPublished, true)))
    .limit(1);
  if (!post) throw new Error("Publish the article first.");
  const posted = await postNotification({
    dealerId: me.dealerId,
    title: `New: ${post.title}`,
    message: post.standfirst || post.excerpt,
    kind: "blog",
    link: `/blog/${post.slug}`,
    imageUrl: post.coverImageUrl ? shareImageUrl(post.coverImageUrl) : null,
    eventKey: `blog:${post.id}`,
    createdBy: me.id,
    push: true,
  });
  const sendId = await createArticleSend(me.dealerId, post);
  if (sendId) after(() => deliver(sendId).catch((e) => console.error("[blog] article email failed", e)));
  await db.update(blogPosts).set({ announcedAt: new Date() }).where(eq(blogPosts.id, id));
  return { bell: Boolean(posted), email: sendId ? "sending" : "already" };
}

/** Publishing makes it live and, the first time, announces it. Unpublishing takes it down; its address is kept. */
export async function setPublished(id: string, publish: boolean): Promise<Result & { announced?: boolean }> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), eq(blogPosts.dealerId, me.dealerId)))
    .limit(1);
  if (!post) return { ok: false, error: "That article no longer exists." };
  if (publish && !blocksSchema.min(1).safeParse(post.blocks).success)
    return { ok: false, error: "Save a valid article before publishing it." };

  await db
    .update(blogPosts)
    .set({ isPublished: publish, publishedAt: publish ? (post.publishedAt ?? new Date()) : post.publishedAt, updatedAt: new Date() })
    .where(eq(blogPosts.id, id));
  await audit(me, "blog_post", id, "status_change", { isPublished: [post.isPublished, publish] });
  let announced = false;
  if (publish && !post.announcedAt) {
    await announce(me, id);
    announced = true;
  }
  refresh(post.slug);
  return { ok: true, announced };
}

/** For an article published without an announcement (one brought in by script). */
export async function announcePost(id: string): Promise<Result & { detail?: string }> {
  try {
    const me = await editor();
    const r = await announce(me, id);
    revalidatePath("/admin/blog", "layout");
    return {
      ok: true,
      detail:
        r.email === "already"
          ? "Posted to the bell; subscribers had already been emailed."
          : "Posted to the bell and phones; emailing subscribers now.",
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Only an article that was never published can be deleted; a published one is unpublished instead, so its links never break. */
export async function deleteDraft(id: string): Promise<Result> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const [gone] = await db
    .delete(blogPosts)
    .where(and(eq(blogPosts.id, id), eq(blogPosts.dealerId, me.dealerId), eq(blogPosts.isPublished, false), isNull(blogPosts.publishedAt)))
    .returning({ id: blogPosts.id });
  if (!gone) return { ok: false, error: "Only an unpublished draft can be deleted." };
  await audit(me, "blog_post", id, "delete");
  refresh();
  return { ok: true };
}

/* ── Pictures ──────────────────────────────────────────────────────────── */

export async function blogUploadTicket(): Promise<UploadTicket | { error: string }> {
  try {
    await editor();
    return uploadTicket("blog");
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Confirms Cloudinary really stored the picture, and returns its address for the article. */
export async function confirmBlogUpload(asset: UploadedAsset): Promise<{ url: string } | { error: string }> {
  try {
    await editor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  return isGenuineUpload(asset, "blog") ? { url: asset.secure_url } : { error: "That upload could not be verified. Please try again." };
}

/* ── Comments ──────────────────────────────────────────────────────────── */

export async function moderateComment(commentId: string, publish: boolean): Promise<Result> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!z.uuid().safeParse(commentId).success) return { ok: false };
  const [found] = await db
    .select({ slug: blogPosts.slug })
    .from(blogComments)
    .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
    .where(and(eq(blogComments.id, commentId), eq(blogPosts.dealerId, me.dealerId)))
    .limit(1);
  if (!found) return { ok: false, error: "That comment no longer exists." };
  await db.update(blogComments).set({ isApproved: publish, reviewedAt: new Date() }).where(eq(blogComments.id, commentId));
  const post = found;
  await audit(me, "blog_comment", commentId, "status_change", { isApproved: publish });
  refresh(post.slug);
  return { ok: true };
}
