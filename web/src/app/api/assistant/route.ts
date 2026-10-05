import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { after, NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantMessages } from "@/db/schema";
import { devReply } from "@/lib/assistant/dev-reply";
import { knowledge, momentContext, toAssistantCar } from "@/lib/assistant/knowledge";
import { comparePath, DirectiveSplitter, type Directive, type Part } from "@/lib/assistant/parts";
import { reportAssistantFailure } from "@/lib/assistant/health";
import { PERSONA } from "@/lib/assistant/prompt";
import { PHONE_IN_TEXT, summariseConversation } from "@/lib/assistant/summarise";
import { sabicarsDealerId } from "@/lib/leads";
import { activePartnerByCode, PARTNER_COOKIE } from "@/lib/partners";

/**
 * Ask Sabicars. Streams the reply as newline-delimited JSON — the words as
 * they arrive, and cards in place of directives — because a chat that sits
 * blank for four seconds reads as broken.
 */

export const maxDuration = 60;

/** The model is configurable, so cost and quality can be traded without a deploy. */
const MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";
/** One conversation cannot run forever: every message costs money. */
const MAX_MESSAGES = 60;
/** Generous per address — many Nigerian mobile users share one — so it stops floods, not people. */
const PER_ADDRESS_PER_HOUR = 120;
/** A ceiling on the whole day's spend, whoever is asking. */
const DAILY_CAP = Number(process.env.ASSISTANT_DAILY_CAP ?? 4000);
/** How much of the conversation the model re-reads each turn. */
const HISTORY = 30;

const body = z.object({
  message: z.string().trim().min(1).max(1500),
  conversationId: z.uuid().nullish(),
  path: z.string().max(300).nullish(),
});

const busy = (error: string, status: number) => NextResponse.json({ error }, { status });

function ipHash(request: NextRequest): string | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  const standIn = !key && process.env.NODE_ENV !== "production";
  if (!key && !standIn) return busy("Ask Sabicars is not switched on yet — please call or WhatsApp us.", 503);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return busy("That message could not be read — could you try again?", 400);
  const { message, path } = parsed.data;

  const dealerId = await sabicarsDealerId();
  const hash = ipHash(request);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[mine], [today]] = await Promise.all([
    hash
      ? db
          .select({ n: sql<number>`coalesce(sum(${assistantConversations.messageCount}), 0)::int` })
          .from(assistantConversations)
          .where(and(eq(assistantConversations.ipHash, hash), gte(assistantConversations.lastMessageAt, hourAgo)))
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(assistantMessages)
      .where(and(gte(assistantMessages.createdAt, dayAgo), eq(assistantMessages.role, "user"))),
  ]);
  if (mine.n >= PER_ADDRESS_PER_HOUR)
    return busy("We've chatted a lot this hour! Please call or WhatsApp us — we'd love to talk properly.", 429);
  if (today.n >= DAILY_CAP)
    return busy("Ask Sabicars is very busy right now. Please call or WhatsApp us and a person will help straight away.", 503);

  const { text: knowledgeText, bySlug } = await knowledge();
  const pageSlug = /^\/vehicles\/([a-z0-9-]+)$/.exec(path ?? "")?.[1];
  const pageVehicle = pageSlug ? (bySlug.get(pageSlug) ?? null) : null;

  // ── The conversation: continue it, or start one ────────────────────────
  let conversationId = parsed.data.conversationId ?? null;
  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (conversationId) {
    const [existing] = await db
      .select({ messageCount: assistantConversations.messageCount })
      .from(assistantConversations)
      .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.dealerId, dealerId)))
      .limit(1);
    // An unknown id starts afresh rather than failing: the widget keeps the id, and a stale one must never stop someone typing.
    if (!existing) conversationId = null;
    else if (existing.messageCount >= MAX_MESSAGES) {
      return busy("We've covered a lot! Let's pick this up properly — tap “Talk to a person” and someone will call you.", 409);
    } else {
      const rows = await db
        .select({ role: assistantMessages.role, content: assistantMessages.content })
        .from(assistantMessages)
        .where(eq(assistantMessages.conversationId, conversationId))
        .orderBy(desc(assistantMessages.createdAt))
        .limit(HISTORY);
      history = rows.reverse().map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
      // The model expects to be answering the buyer: history always starts with them.
      while (history[0]?.role === "assistant") history.shift();
    }
  }
  if (!conversationId) {
    const [created] = await db
      .insert(assistantConversations)
      .values({ dealerId, landingPath: path?.slice(0, 300) ?? null, vehicleId: pageVehicle?.id ?? null, ipHash: hash })
      .returning({ id: assistantConversations.id });
    conversationId = created.id;
  }
  const convId = conversationId;
  const askedAt = new Date();

  // Referral attribution is read now, while the request's cookies are at hand.
  let partner: { id: string; phone: string } | null = null;
  try {
    partner = await activePartnerByCode(dealerId, (await cookies()).get(PARTNER_COOKIE)?.value ?? "");
  } catch {
    partner = null;
  }

  // ── The reply ──────────────────────────────────────────────────────────
  const chunks: AsyncIterable<string> = key
    ? (async function* () {
        const stream = new Anthropic({ apiKey: key }).messages.stream({
          model: MODEL,
          max_tokens: 1000,
          system: [
            { type: "text", text: PERSONA },
            { type: "text", text: `# What you know — live from the showroom\n\n${knowledgeText}`, cache_control: { type: "ephemeral" } },
            { type: "text", text: `# Right now\n${momentContext({ path: path ?? null, vehicle: pageVehicle })}` },
          ],
          messages: [...history, { role: "user", content: message }],
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
        }
      })()
    : devReply(message, [...bySlug.values()], pageVehicle);

  const resolve = (d: Directive): Part | null => {
    if (d.kind === "callback") return { kind: "callback" };
    if (d.kind === "race") return { kind: "race", race: d.race };
    // The buyer on a car's page is looking at it already: a card for it would only repeat the page. Comparisons keep it.
    const slugs = d.kind === "cars" && pageVehicle ? d.slugs.filter((s) => s !== pageVehicle.slug) : d.slugs;
    const cars = slugs.map((s) => bySlug.get(s)).filter((v) => v !== undefined);
    if (!cars.length) return null;
    if (d.kind === "compare" && cars.length >= 2)
      return { kind: "compare", cars: cars.map(toAssistantCar), href: comparePath(cars.map((c) => c.slug)) };
    return { kind: "cars", cars: cars.map(toAssistantCar) };
  };

  let failure: unknown = null;
  let finished: () => void = () => {};
  const persisted = new Promise<void>((r) => (finished = r));
  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(`${JSON.stringify(o)}\n`);

  // The visitor may close the chat mid-reply. The reply is still finished and saved; it just has nowhere to go.
  let listening = true;
  const readable = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        if (!listening) return;
        try {
          controller.enqueue(line(o));
        } catch {
          listening = false;
        }
      };
      send({ type: "id", conversationId: convId });
      const splitter = new DirectiveSplitter();
      const shown: string[] = [];
      let full = "";
      const emit = (pieces: (string | Directive)[]) => {
        for (const piece of pieces) {
          if (typeof piece === "string") {
            send({ type: "text", text: piece });
            continue;
          }
          const part = resolve(piece);
          if (!part) continue;
          if (part.kind === "cars" || part.kind === "compare") shown.push(...part.cars.map((c) => c.slug));
          send({ type: "part", part });
        }
      };
      try {
        for await (const chunk of chunks) {
          full += chunk;
          emit(splitter.push(chunk));
        }
        emit(splitter.flush());
      } catch (e) {
        console.error("[assistant] reply failed", e);
        failure = e;
        send({ type: "error", error: "Sorry — something went wrong on our side. Please try again, or call or WhatsApp us." });
      }

      // Saved before the stream closes, so the record never depends on the visitor staying on the page.
      try {
        if (full.trim()) {
          await db.insert(assistantMessages).values([
            { conversationId: convId, role: "user", content: message, createdAt: askedAt },
            { conversationId: convId, role: "assistant", content: full, createdAt: new Date() },
          ]);
          await db
            .update(assistantConversations)
            .set({
              messageCount: sql`${assistantConversations.messageCount} + 2`,
              lastMessageAt: new Date(),
              vehiclesShown: sql`(select coalesce(jsonb_agg(distinct s), '[]'::jsonb) from jsonb_array_elements_text(${assistantConversations.vehiclesShown} || ${JSON.stringify(shown)}::jsonb) s)`,
            })
            .where(eq(assistantConversations.id, convId));
        }
      } catch (e) {
        console.error("[assistant] saving the conversation failed", e);
      }
      if (listening) controller.close();
      finished();
    },
    cancel() {
      listening = false;
    },
  });

  // Summarised once the buyer has their answer — every other turn, or at once when they share a number.
  after(async () => {
    await persisted;
    if (failure) {
      await reportAssistantFailure(dealerId, failure).catch((e) => console.error("[assistant] reporting the failure failed", e));
      return;
    }
    try {
      const [c] = await db
        .select({ messageCount: assistantConversations.messageCount })
        .from(assistantConversations)
        .where(eq(assistantConversations.id, convId));
      const turns = (c?.messageCount ?? 0) / 2;
      if (PHONE_IN_TEXT.test(message) || /@/.test(message) || (turns >= 2 && turns % 2 === 0)) await summariseConversation(convId, partner);
    } catch (e) {
      console.error("[assistant] summarising failed", e);
    }
  });

  return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
