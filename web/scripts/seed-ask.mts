#!/usr/bin/env node
/**
 * Puts the first answers (src/content/ask-answers.ts) on /ask.
 *
 * A new answer is inserted, published. One already in the database belongs to
 * staff — who may have edited it in the admin — and is left alone unless run
 * with --force.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-ask.mts [--force]
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { ASK_ANSWERS } from "../src/content/ask-answers";

const force = process.argv.includes("--force");
const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const [dealer] = await db.select().from(schema.dealers).where(eq(schema.dealers.slug, "sabicars")).limit(1);
if (!dealer) throw new Error("Run the legacy import first: the Sabicars dealer row is missing.");

for (const [position, a] of ASK_ANSWERS.entries()) {
  const [existing] = await db
    .select({ id: schema.askAnswers.id })
    .from(schema.askAnswers)
    .where(and(eq(schema.askAnswers.dealerId, dealer.id), eq(schema.askAnswers.slug, a.slug)))
    .limit(1);
  if (!existing) {
    await db.insert(schema.askAnswers).values({ dealerId: dealer.id, ...a, position, isPublished: true, publishedAt: new Date() });
    console.log(`inserted   ${a.slug}`);
  } else if (force) {
    await db
      .update(schema.askAnswers)
      .set({ question: a.question, answer: a.answer, position, updatedAt: new Date() })
      .where(eq(schema.askAnswers.id, existing.id));
    console.log(`overwrote  ${a.slug}`);
  } else {
    console.log(`kept       ${a.slug} (staff's; --force to overwrite)`);
  }
}
await client.end();
