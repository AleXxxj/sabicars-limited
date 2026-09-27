"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { askAnswers, assistantConversations } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireStaff, type StaffMember } from "@/lib/auth";
import { slugPart } from "@/lib/seo/search-terms";

type Result = { ok: boolean; error?: string; id?: string };

async function editor(): Promise<StaffMember> {
  const me = await requireStaff();
  if (me.role === "sales") throw new Error("Only a manager can publish answers.");
  return me;
}

function refresh(slug?: string) {
  revalidatePath("/ask");
  if (slug) revalidatePath(`/ask/${slug}`);
  revalidatePath("/llms.txt");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/ask");
}

/** An address from the question: short, readable, and never one already taken. */
async function freeSlug(dealerId: string, question: string): Promise<string> {
  const base =
    slugPart(question)
      .split("-")
      .reduce((acc, w) => (acc.length + w.length < 70 ? (acc ? `${acc}-${w}` : w) : acc), "") || "answer";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db
      .select({ id: askAnswers.id })
      .from(askAnswers)
      .where(and(eq(askAnswers.dealerId, dealerId), eq(askAnswers.slug, slug)))
      .limit(1);
    if (!taken) return slug;
  }
}

const schema = z.object({
  id: z.uuid().optional(),
  question: z.string().trim().min(8, "Write the question as a buyer would ask it").max(200),
  answer: z.string().trim().min(20, "Write the answer").max(4000),
  conversationId: z.uuid().nullish(),
  publish: z.boolean(),
});

export type AnswerInput = z.input<typeof schema>;

/**
 * Saves an answer for /ask. A new one gets its address from the question; a
 * published one keeps its address for good, so links and search results never
 * break. The assistant reads published answers back, so it answers the same way.
 */
export async function saveAnswer(input: AnswerInput): Promise<Result> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the answer." };
  const v = parsed.data;
  // Directives are for the chat window, not a public page.
  const answer = v.answer
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (v.id) {
    const [existing] = await db
      .select()
      .from(askAnswers)
      .where(and(eq(askAnswers.id, v.id), eq(askAnswers.dealerId, me.dealerId)))
      .limit(1);
    if (!existing) return { ok: false, error: "That answer no longer exists." };
    await db
      .update(askAnswers)
      .set({
        question: v.question,
        answer,
        isPublished: v.publish,
        publishedAt: v.publish ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(askAnswers.id, existing.id));
    await audit(me, "ask_answer", existing.id, "update", { question: v.question, isPublished: v.publish });
    refresh(existing.slug);
    return { ok: true, id: existing.id };
  }

  const slug = await freeSlug(me.dealerId, v.question);
  const [row] = await db
    .insert(askAnswers)
    .values({
      dealerId: me.dealerId,
      slug,
      question: v.question,
      answer,
      conversationId: v.conversationId ?? null,
      isPublished: v.publish,
      publishedAt: v.publish ? new Date() : null,
      position: 1000,
      createdBy: me.id,
    })
    .returning({ id: askAnswers.id });
  await audit(me, "ask_answer", row.id, "create", { question: v.question, isPublished: v.publish });
  refresh(slug);
  return { ok: true, id: row.id };
}

/** Only an answer that was never published can be deleted; a published one is unpublished instead, so its link never breaks for good. */
export async function deleteAnswer(id: string): Promise<Result> {
  let me: StaffMember;
  try {
    me = await editor();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const deleted = await db
    .delete(askAnswers)
    .where(and(eq(askAnswers.id, id), eq(askAnswers.dealerId, me.dealerId), isNull(askAnswers.publishedAt)))
    .returning({ id: askAnswers.id });
  if (!deleted.length) return { ok: false, error: "A published answer can be unpublished, not deleted." };
  await audit(me, "ask_answer", id, "delete");
  refresh();
  return { ok: true };
}

/** A conversation that asked for a person has had one. */
export async function markConversationHandled(id: string): Promise<Result> {
  const me = await requireStaff();
  await db
    .update(assistantConversations)
    .set({ needsHuman: false })
    .where(
      and(
        eq(assistantConversations.id, id),
        eq(assistantConversations.dealerId, me.dealerId),
        ne(assistantConversations.needsHuman, false),
      ),
    );
  revalidatePath("/admin/conversations", "layout");
  return { ok: true };
}
