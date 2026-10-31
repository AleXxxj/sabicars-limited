import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { askAnswers, assistantConversations, assistantMessages, leads, staff, vehicles, type AskAnswer } from "@/db/schema";
import { openMessage } from "@/lib/assistant/vault";
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

export type ConversationView = "all" | "waiting" | "leads" | "person";

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
  /** "seller": the buyer asked for the team; "assistant": a chat with Sabi. */
  mode: string;
  /** A buyer's message is waiting for a person since then. */
  awaitingSince: Date | null;
}

export async function conversations(view: ConversationView, limit = 60): Promise<ConversationRow[]> {
  const dealerId = await sabicarsDealerId();
  const where = [eq(assistantConversations.dealerId, dealerId), sql`${assistantConversations.messageCount} > 0`];
  if (view === "leads") where.push(isNotNull(assistantConversations.leadId));
  if (view === "person") where.push(eq(assistantConversations.needsHuman, true));
  if (view === "waiting") where.push(isNotNull(assistantConversations.awaitingSince));
  const firstQuestion = sql<string | null>`(
    select ${assistantMessages.content} from ${assistantMessages}
    where ${assistantMessages.conversationId} = ${assistantConversations.id} and ${assistantMessages.role} = 'user'
    order by ${assistantMessages.createdAt} asc limit 1
  )`;
  const rows = await db
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
      mode: assistantConversations.mode,
      awaitingSince: assistantConversations.awaitingSince,
    })
    .from(assistantConversations)
    .leftJoin(leads, eq(leads.id, assistantConversations.leadId))
    .where(and(...where))
    // A buyer waiting for a person comes first, longest wait at the top; then the rest, newest first.
    .orderBy(sql`${assistantConversations.awaitingSince} asc nulls last`, desc(assistantConversations.lastMessageAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, firstQuestion: r.firstQuestion ? openMessage(r.firstQuestion) : null }));
}

export async function conversationCounts(): Promise<Record<ConversationView, number>> {
  const dealerId = await sabicarsDealerId();
  const [row] = await db
    .select({
      all: count(),
      waiting: sql<number>`count(*) filter (where ${assistantConversations.awaitingSince} is not null)::int`,
      leads: sql<number>`count(*) filter (where ${assistantConversations.leadId} is not null)::int`,
      person: sql<number>`count(*) filter (where ${assistantConversations.needsHuman})::int`,
    })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.dealerId, dealerId), sql`${assistantConversations.messageCount} > 0`));
  return { all: row.all, waiting: row.waiting, leads: row.leads, person: row.person };
}

/** Seller chats where a buyer's message is waiting for a person: the badge on Conversations. */
export async function waitingChatsCount(dealerId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.dealerId, dealerId), isNotNull(assistantConversations.awaitingSince)));
  return row?.n ?? 0;
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
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      createdAt: assistantMessages.createdAt,
      staffName: sql<string | null>`(select nullif(split_part(btrim(${staff.fullName}), ' ', 1), '') from ${staff} where ${staff.id} = ${assistantMessages.staffId})`,
    })
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, id))
    .orderBy(asc(assistantMessages.createdAt));
  const published = await db
    .select({ id: askAnswers.id, question: askAnswers.question, isPublished: askAnswers.isPublished })
    .from(askAnswers)
    .where(eq(askAnswers.conversationId, id));
  return {
    ...conversation.c,
    leadName: conversation.leadName,
    vehicleSlug: conversation.vehicleSlug,
    messages: messages.map((m) => ({ ...m, content: openMessage(m.content) })),
    published,
  };
}
