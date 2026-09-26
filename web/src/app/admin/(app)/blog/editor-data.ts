import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import type { EditorPost } from "@/components/admin/BlogEditor";
import { searchTerms } from "@/lib/repositories/vehicles";

/** What the editor offers in its menus: the categories in use, and every model family in stock for a "cars" block. */
export async function editorOptions(dealerId: string) {
  const [cats, terms] = await Promise.all([
    db.selectDistinct({ category: blogPosts.category }).from(blogPosts).where(eq(blogPosts.dealerId, dealerId)),
    searchTerms(),
  ]);
  return {
    categories: [...new Set(["Buying Guide", "Financing", "Ownership", "Fleet", ...cats.map((c) => c.category)])],
    terms: [
      { slug: "hummer-bus", label: "Hummer buses" },
      ...terms.filter((t) => t.inStock > 0).map((t) => ({ slug: t.slug, label: `${t.label} (${t.inStock} in stock)` })),
    ],
  };
}

export async function editorPost(dealerId: string, id: string): Promise<EditorPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.dealerId, dealerId), eq(blogPosts.id, id)))
    .limit(1);
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    standfirst: p.standfirst ?? p.excerpt,
    category: p.category,
    coverImageUrl: p.coverImageUrl ?? "",
    coverVideoUrl: p.coverVideoUrl ?? "",
    tags: p.tags.join(", "),
    blocks: p.blocks,
    isPublished: p.isPublished,
    announced: Boolean(p.announcedAt),
    everPublished: Boolean(p.publishedAt),
  };
}
