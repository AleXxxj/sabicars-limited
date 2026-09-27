import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { askAnswers, assistantConversations, assistantMessages, leads, vehicles, type AskAnswer } from "@/db/schema";
import { sabicarsDealerId } from "@/lib/leads";

/* ── Public answers (/ask) ─────────────────────────────────────────────── */

export const publishedAnswers = cache(async (): Promise<AskAnswer[]> =>
  db
    .select()
    .from(askAnswers)
    .where(and(eq(askAnswers.dealerId, await sabicarsDealerId()), eq(askAnswers.isPublished, true)))
    .orderBy(asc(askAnswers.position), asc(askAnswers.publishedAt)),
);

export const answerBySlug = cache(async (slug: string): Promise<AskAnswer | null> => {
  const [row] = await db
    .select()
    .from(askAnswers)
    .where(and(eq(askAnswers.dealerId, await sabicarsDealerId()), eq(askAnswers.slug, slug), eq(askAnswers.isPublished, true)))
    .limit(1);
  return row ?? null;
});

/* ── Staff ─────────────────────────────────────────────────────────────── */

export async function allAnswers(): Promise<AskAnswer[]> {
  return db
    .select()
    .from(askAnswers)
    .where(eq(askAnswers.dealerId, await sabicarsDealerId()))
    .orderBy(desc(askAnswers.isPublished), asc(askAnswers.position), desc(askAnswers.updatedAt));
}

export async function answerById(id: string): Promise<AskAnswer | null> {
  const [row] = await db
    .select()
    .from(askAnswers)
    .where(and(eq(askAnswers.dealerId, await sabicarsDealerId()), eq(askAnswers.id, id)))
    .limit(1);
  return row ?? null;
}

export type ConversationView = "all" | "leads" | "person";

export interface ConversationRow {
  id: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  summary: string | null;
  intent: string | null;
  needsHuman: boolean;
  landingPath: string | null;
  leadId: string | null;
  leadName: string | null;
  vehiclesShown: string[];
  firstQuestion: string | null;
}

export async function conversations(view: ConversationView, limit = 60): Promise<ConversationRow[]> {
  const dealerId = await sabicarsDealerId();
  const where = [eq(assistantConversations.dealerId, dealerId), sql`${assistantConversations.messageCount} > 0`];
  if (view === "leads") where.push(isNotNull(assistantConversations.leadId));
  if (view === "person") where.push(eq(assistantConversations.needsHuman, true));
  const firstQuestion = sql<string | null>`(
    select ${assistantMessages.content} from ${assistantMessages}
    where ${assistantMessages.conversationId} = ${assistantConversations.id} and ${assistantMessages.role} = 'user'
    order by ${assistantMessages.createdAt} asc limit 1
  )`;
  return db
    .select({
      id: assistantConversations.id,
      createdAt: assistantConversations.createdAt,
      lastMessageAt: assistantConversations.lastMessageAt,
      messageCount: assistantConversations.messageCount,
      summary: assistantConversations.summary,
      intent: assistantConversations.intent,
      needsHuman: assistantConversations.needsHuman,
      landingPath: assistantConversations.landingPath,
      leadId: assistantConversations.leadId,
      leadName: leads.name,
      vehiclesShown: assistantConversations.vehiclesShown,
      firstQuestion,
    })
    .from(assistantConversations)
    .leftJoin(leads, eq(leads.id, assistantConversations.leadId))
    .where(and(...where))
    .orderBy(desc(assistantConversations.lastMessageAt))
    .limit(limit);
}

export async function conversationCounts(): Promise<Record<ConversationView, number>> {
  const dealerId = await sabicarsDealerId();
  const [row] = await db
    .select({
      all: count(),
      leads: sql<number>`count(*) filter (where ${assistantConversations.leadId} is not null)::int`,
      person: sql<number>`count(*) filter (where ${assistantConversations.needsHuman})::int`,
    })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.dealerId, dealerId), sql`${assistantConversations.messageCount} > 0`));
  return { all: row.all, leads: row.leads, person: row.person };
}

export async function conversationDetail(id: string) {
  const dealerId = await sabicarsDealerId();
  const [conversation] = await db
    .select({
      c: assistantConversations,
      leadName: leads.name,
      vehicleSlug: vehicles.slug,
    })
    .from(assistantConversations)
    .leftJoin(leads, eq(leads.id, assistantConversations.leadId))
    .leftJoin(vehicles, eq(vehicles.id, assistantConversations.vehicleId))
    .where(and(eq(assistantConversations.id, id), eq(assistantConversations.dealerId, dealerId)))
    .limit(1);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, id))
    .orderBy(asc(assistantMessages.createdAt));
  const published = await db
    .select({ id: askAnswers.id, question: askAnswers.question, isPublished: askAnswers.isPublished })
    .from(askAnswers)
    .where(eq(askAnswers.conversationId, id));
  return { ...conversation.c, leadName: conversation.leadName, vehicleSlug: conversation.vehicleSlug, messages, published };
}
