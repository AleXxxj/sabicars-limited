#!/usr/bin/env node
/**
 * Puts the articles written in code (src/content/articles) into the database.
 *
 * An article is inserted once; after that it belongs to the editor in the
 * admin, and a re-run leaves it alone — unless run with --force, which
 * overwrites it with the version here. It is published but not announced:
 * staff announce it to subscribers from the admin.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-articles.mts [--force]
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { blocksSchema, plainText } from "../src/lib/blog/blocks";
import { hiaceHummerGuide } from "../src/content/articles/hiace-hummer-buyers-guide";

const force = process.argv.includes("--force");
const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const [dealer] = await db.select().from(schema.dealers).where(eq(schema.dealers.slug, "sabicars")).limit(1);
if (!dealer) throw new Error("Run the legacy import first: the Sabicars dealer row is missing.");

for (const a of [hiaceHummerGuide]) {
  const blocks = blocksSchema.parse(a.blocks);
  const values = {
    dealerId: dealer.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    standfirst: a.standfirst,
    excerpt: a.standfirst || plainText(blocks, 200),
    blocks,
    coverImageUrl: a.coverImageUrl,
    tags: a.tags,
    author: "Sabicars Team",
    isPublished: true,
    isFeatured: true,
  };
  const [existing] = await db
    .select({ id: schema.blogPosts.id })
    .from(schema.blogPosts)
    .where(and(eq(schema.blogPosts.dealerId, dealer.id), eq(schema.blogPosts.slug, a.slug)))
    .limit(1);
  if (existing && !force) {
    console.log(`kept      ${a.slug} (already in the database; --force to overwrite)`);
    continue;
  }
  if (existing) {
    await db
      .update(schema.blogPosts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.blogPosts.id, existing.id));
    console.log(`updated   ${a.slug}`);
  } else {
    await db.insert(schema.blogPosts).values({ ...values, publishedAt: new Date() });
    console.log(`inserted  ${a.slug}`);
  }
  // One featured article leads the Insights page.
  await db
    .update(schema.blogPosts)
    .set({ isFeatured: false })
    .where(and(eq(schema.blogPosts.dealerId, dealer.id), eq(schema.blogPosts.isFeatured, true)));
  await db
    .update(schema.blogPosts)
    .set({ isFeatured: true })
    .where(and(eq(schema.blogPosts.dealerId, dealer.id), eq(schema.blogPosts.slug, a.slug)));
}
await client.end();
