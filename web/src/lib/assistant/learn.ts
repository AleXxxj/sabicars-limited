import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, assistantMessages, assistantReviews, type AssistantReport } from "@/db/schema";
import { describeDirectives } from "@/lib/assistant/parts";
import { publishedAnswers } from "@/lib/repositories/ask";
import { listedVehicles } from "@/lib/repositories/vehicles";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * How the assistant learns: not by retraining — it would learn wrong answers
 * as readily as right ones — but by reading the week's conversations and
 * telling the owner, in plain words, what buyers asked, what it could not
 * answer (with a draft answer each), what people wanted that was not in
 * stock, and what lost them. The owner publishes the good drafts on /ask,
 * and from then on the assistant knows them and tells everyone the same.
 */

const REVIEW_DAYS = 7;
/** The same model as the chat, configurable the same way. */
const REVIEW_MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";
/** Enough of a week to read; a viral week is sampled, newest first. */
const MAX_CONVERSATIONS = 150;
/** Each conversation trimmed, so a long one cannot crowd out the rest. */
const PER_CONVERSATION_CHARS = 900;

const PROMPT = `You review a week of chats between car buyers and "Ask Sabicars", the assistant on a Lagos car dealership's website. The owner reads your report every Monday to make the assistant better. Write for a busy business owner: plain words, nothing vague.

Reply with JSON only, no other text, in this exact shape:
{"topQuestions":[{"question":"<as a buyer would ask it>","count":<how many conversations asked something like it>}],
 "unanswered":[{"question":"<what they asked>","draftAnswer":"<an answer in 2-4 short sentences, written for the buyer, using ONLY facts from the chats or the published answers below; where a fact is missing, write [OWNER: fill in …]>","timesAsked":<n>}],
 "wantedNotInStock":[{"car":"<make model, year if said>","count":<n>}],
 "confusing":[{"what":"<a reply or wording that lost someone, quoted short>","instead":"<what would have worked>"}],
 "notes":["<anything else worth the owner's minute: a pattern, a risk, a win>"]}

Rules:
- Group near-identical questions together and count them. Up to 8 top questions, 8 unanswered, 8 cars, 6 confusing, 4 notes. Empty lists are fine.
- "Unanswered" means the assistant said it did not know, said the team would confirm, or dodged — or the buyer asked again or left. Do NOT list questions the published answers already cover.
- Never invent a fact, a price or a policy. A draft answer may only use what the chats or the published answers state; mark anything else [OWNER: …].
- Never include a buyer's name, phone number or email anywhere in the report.
- Nigerian English and Pidgin are normal; do not flag them as confusing.`;

const item = (props: Record<string, { type: string; description?: string }>, required: string[]) => ({
  type: "array" as const,
  items: { type: "object" as const, properties: props, required },
});
const REPORT_TOOL: Anthropic.Tool = {
  name: "file_report",
  description: "Files the week's report for the owner. Call it exactly once, with every list (empty lists are fine).",
  input_schema: {
    type: "object",
    properties: {
      topQuestions: item({ question: { type: "string", description: "as a buyer would ask it" }, count: { type: "integer" } }, ["question", "count"]),
      unanswered: item(
        {
          question: { type: "string" },
          draftAnswer: { type: "string", description: "2-4 short sentences for the buyer, only facts from the chats or published answers; [OWNER: fill in …] where a fact is missing" },
          timesAsked: { type: "integer" },
        },
        ["question", "draftAnswer", "timesAsked"],
      ),
      wantedNotInStock: item({ car: { type: "string" }, count: { type: "integer" } }, ["car", "count"]),
      confusing: item({ what: { type: "string" }, instead: { type: "string" } }, ["what", "instead"]),
      notes: { type: "array", items: { type: "string" } },
    },
    required: ["topQuestions", "unanswered", "wantedNotInStock", "confusing", "notes"],
  },
};

function parse(raw: string): AssistantReport | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const r = JSON.parse(raw.slice(start, end + 1)) as Partial<AssistantReport>;
    return {
      topQuestions: r.topQuestions ?? [],
      unanswered: r.unanswered ?? [],
      wantedNotInStock: r.wantedNotInStock ?? [],
      confusing: r.confusing ?? [],
      notes: r.notes ?? [],
    };
  } catch {
    return null;
  }
}

export interface ReviewResult {
  reviewed: number;
  reportId: string | null;
}

/** Reads the last week's conversations and files the report. Returns how many it read; files nothing for an empty week. */
export async function reviewConversations(dealerId: string, until = new Date()): Promise<ReviewResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { reviewed: 0, reportId: null };
  const since = new Date(until.getTime() - REVIEW_DAYS * 86_400_000);

  const convs = await db
    .select({ id: assistantConversations.id, intent: assistantConversations.intent, needsHuman: assistantConversations.needsHuman })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.dealerId, dealerId), gte(assistantConversations.lastMessageAt, since), lt(assistantConversations.lastMessageAt, until)))
    .orderBy(desc(assistantConversations.lastMessageAt))
    .limit(MAX_CONVERSATIONS);
  if (!convs.length) return { reviewed: 0, reportId: null };

  const rows = await db
    .select({ conversationId: assistantMessages.conversationId, role: assistantMessages.role, content: assistantMessages.content })
    .from(assistantMessages)
    .where(inArray(assistantMessages.conversationId, convs.map((c) => c.id)))
    .orderBy(asc(assistantMessages.createdAt));
  const byConversation = new Map<string, string[]>();
  for (const r of rows) {
    const line = `${r.role === "assistant" ? "Assistant" : "Buyer"}: ${describeDirectives(r.content)}`;
    byConversation.set(r.conversationId, [...(byConversation.get(r.conversationId) ?? []), line]);
  }
  const transcripts = convs
    .map((c, i) => {
      const text = (byConversation.get(c.id) ?? []).join("\n");
      const cut = text.length > PER_CONVERSATION_CHARS ? `${text.slice(0, PER_CONVERSATION_CHARS)} …` : text;
      return `## Chat ${i + 1}${c.intent ? ` — ${c.intent}` : ""}${c.needsHuman ? " (asked for a person)" : ""}\n${cut}`;
    })
    .join("\n\n");

  const [answers, stock] = await Promise.all([publishedAnswers(), listedVehicles()]);
  const context = [
    `# Published answers already on the site (do not list these as unanswered)\n${answers.map((a) => `- ${a.question}`).join("\n") || "- none yet"}`,
    `# Cars in stock this week\n${stock.map((v) => vehicleTitle(v)).join("; ")}`,
    `# The week's chats (${convs.length})\n${transcripts}`,
  ].join("\n\n");

  // Once a week, so the main model's judgement is worth it: the drafts are what the owner publishes. The report is
  // a tool the model must call, in a fixed shape — handed a page of chats, a model asked for free text will
  // otherwise carry the chats on instead of reporting.
  const response = await new Anthropic({ apiKey: key }).messages.create({
    model: REVIEW_MODEL,
    max_tokens: 4000,
    system: PROMPT,
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: REPORT_TOOL.name },
    messages: [{ role: "user", content: `${context}\n\n# Now file the report\nCall ${REPORT_TOOL.name} once with the whole report. Do not continue or quote the chats.` }],
  });
  const call = response.content.find((b) => b.type === "tool_use");
  const report = call && call.type === "tool_use" ? parse(JSON.stringify(call.input)) : null;
  if (!report) {
    console.error("[assistant] weekly review was not a report", { stop: response.stop_reason, blocks: response.content.map((b) => b.type) });
    throw new Error("The weekly review did not come back as a report.");
  }

  const [saved] = await db
    .insert(assistantReviews)
    .values({ dealerId, periodStart: since, periodEnd: until, conversations: convs.length, report })
    .returning({ id: assistantReviews.id });
  return { reviewed: convs.length, reportId: saved.id };
}

/** The newest report, for the admin. */
export async function latestReview(dealerId: string) {
  const [row] = await db.select().from(assistantReviews).where(eq(assistantReviews.dealerId, dealerId)).orderBy(desc(assistantReviews.createdAt)).limit(1);
  return row ?? null;
}
