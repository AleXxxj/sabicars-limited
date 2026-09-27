#!/usr/bin/env node
/**
 * Puts the articles written in code (src/content/articles) into the database.
 *
 * - A new article is inserted, published.
 * - An old-site post that has not been rewritten yet (it has no hook line) is
 *   replaced by its rewrite at the same address — its reads, reactions,
 *   comments and original date are kept.
 * - Anything else already in the database belongs to the editor in the admin
 *   and is left alone, unless run with --force.
 *
 * Nothing here announces an article: staff do that from the admin.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-articles.mts [--force]
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, ne } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { blocksSchema, plainText, type Block } from "../src/lib/blog/blocks";
import { drivePlanExplained } from "../src/content/articles/drive-plan-explained";
import { fiveMillionNaira } from "../src/content/articles/five-million-naira";
import { hiaceHummerGuide } from "../src/content/articles/hiace-hummer-buyers-guide";
import { inspectAUsedCar } from "../src/content/articles/inspect-a-used-car";
import { bestSuvsForNigerianRoads } from "../src/content/articles/best-suvs-for-nigerian-roads";
import { highlanderVsGx460 } from "../src/content/articles/highlander-vs-gx-460";
import { tokunboTruck } from "../src/content/articles/tokunbo-truck";

interface Article {
  slug: string;
  title: string;
  category: string;
  standfirst: string;
  coverImageUrl: string;
  tags: string[];
  blocks: Block[];
}

/** The first leads the Insights page. */
const ARTICLES: Article[] = [
  hiaceHummerGuide,
  drivePlanExplained,
  inspectAUsedCar,
  fiveMillionNaira,
  highlanderVsGx460,
  bestSuvsForNigerianRoads,
  tokunboTruck,
];

const force = process.argv.includes("--force");
const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const [dealer] = await db.select().from(schema.dealers).where(eq(schema.dealers.slug, "sabicars")).limit(1);
if (!dealer) throw new Error("Run the legacy import first: the Sabicars dealer row is missing.");

for (const a of ARTICLES) {
  const blocks = blocksSchema.parse(a.blocks);
  const content = {
    title: a.title,
    category: a.category,
    standfirst: a.standfirst,
    excerpt: a.standfirst || plainText(blocks, 200),
    blocks,
    coverImageUrl: a.coverImageUrl,
    tags: a.tags,
  };
  const [existing] = await db
    .select({ id: schema.blogPosts.id, standfirst: schema.blogPosts.standfirst })
    .from(schema.blogPosts)
    .where(and(eq(schema.blogPosts.dealerId, dealer.id), eq(schema.blogPosts.slug, a.slug)))
    .limit(1);

  if (!existing) {
    await db.insert(schema.blogPosts).values({ ...content, dealerId: dealer.id, slug: a.slug, author: "Sabicars Team", isPublished: true, publishedAt: new Date() });
    console.log(`inserted   ${a.slug}`);
  } else if (force || !existing.standfirst) {
    await db
      .update(schema.blogPosts)
      .set({ ...content, isPublished: true, updatedAt: new Date() })
      .where(eq(schema.blogPosts.id, existing.id));
    console.log(`${existing.standfirst ? "overwrote " : "rewrote   "} ${a.slug}`);
  } else {
    console.log(`kept       ${a.slug} (edited in the admin; --force to overwrite)`);
  }
}

// One featured article leads the Insights page.
const lead = ARTICLES[0].slug;
await db
  .update(schema.blogPosts)
  .set({ isFeatured: false })
  .where(and(eq(schema.blogPosts.dealerId, dealer.id), ne(schema.blogPosts.slug, lead)));
await db
  .update(schema.blogPosts)
  .set({ isFeatured: true })
  .where(and(eq(schema.blogPosts.dealerId, dealer.id), eq(schema.blogPosts.slug, lead)));
await client.end();
