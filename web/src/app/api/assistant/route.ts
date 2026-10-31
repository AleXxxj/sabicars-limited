import { createHash, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { after, NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantMessages } from "@/db/schema";
import { devReply } from "@/lib/assistant/dev-reply";
import { knowledge, momentContext, toAssistantCar } from "@/lib/assistant/knowledge";
import { buyerMemory, DEVICE_COOKIE } from "@/lib/assistant/memory";
import { openMessage, sealMessage } from "@/lib/assistant/vault";
import { comparePath, DirectiveSplitter, type Directive, type Part } from "@/lib/assistant/parts";
import { reportAssistantFailure } from "@/lib/assistant/health";
import { PERSONA } from "@/lib/assistant/prompt";
import { sabiMayAnswer, sellerWaitSeconds } from "@/lib/assistant/seller";
import { alertStaffAboutChat } from "@/lib/assistant/seller-room";
import { PHONE_IN_TEXT, summariseConversation } from "@/lib/assistant/summarise";
import { sabicarsDealerId } from "@/lib/leads";
import { activePartnerByCode, PARTNER_COOKIE } from "@/lib/partners";

/**
 * Ask Sabicars. Streams the reply as newline-delimited JSON — the words as
 * they arrive, and cards in place of directives — because a chat that sits
 * blank for four seconds reads as broken.
 *
 * Two kinds of room. In the usual one, Sabi answers every message. In a
 * "Chat with seller" room (mode "seller") the buyer's message is saved and
 * the team's phones are pinged, and the answer is a person's — unless nobody
 * is free within the typical wait, when the buyer's screen asks Sabi to
 * answer (answer: true) and the server checks that it may (lib/assistant/seller.ts).
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

const body = z
  .object({
    message: z.string().trim().min(1).max(1500).optional(),
    conversationId: z.uuid().nullish(),
    path: z.string().max(300).nullish(),
    /** "seller": this message goes to the team first. */
    mode: z.enum(["assistant", "seller"]).optional(),
    /** The buyer's screen asking Sabi to answer the message waiting in a seller room. */
    answer: z.boolean().optional(),
  })
  .refine((b) => b.answer || b.message, { message: "A message is needed." });

const busy = (error: string, status: number) => NextResponse.json({ error }, { status });

function ipHash(request: NextRequest): string | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
}

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The conversation as the model reads it. A person's words are shown as the
 * assistant side, marked as the team's, so Sabi keeps to what they said.
 * Neighbouring turns from the same side are joined: the model expects the
 * two sides to alternate, and the history must start with the buyer.
 */
function asTurns(rows: { role: string; content: string }[]): Turn[] {
  const turns: Turn[] = [];
  for (const r of rows) {
    const role: Turn["role"] = r.role === "user" ? "user" : "assistant";
    const content = r.role === "staff" ? `(A person on the Sabicars team wrote:) ${openMessage(r.content)}` : openMessage(r.content);
    const last = turns.at(-1);
    if (last && last.role === role) last.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

const SELLER_ROOM = `# This is a "Chat with seller" room
The buyer tapped "Chat with seller": they asked for a person on the team. The team's phones have been told. You are answering because nobody was free within the usual wait, or the showroom is closed.
- If no reply from you or from a person exists yet in this room, begin with one short line: the team has been told and a person will join when free; or, if the showroom is closed, that the team will see this when it opens. After that line, answer them properly. Do not repeat the line in later replies.
- Never pretend to be a person. If asked, you are Sabi, the assistant, and a person is on the way.
- Where a person on the team has written in this room, keep to what they said. Do not contradict or restate a price or promise they gave.
- The team already has this chat on their phones, so do not offer [[callback]] or push the phone numbers here unless the buyer asks to be called.`;

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  const standIn = !key && process.env.NODE_ENV !== "production";
  if (!key && !standIn) return busy("Ask Sabicars is not switched on yet — please call or WhatsApp us.", 503);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return busy("That message could not be read — could you try again?", 400);
  const { path, mode, answer } = parsed.data;

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
  // The device's own id, from its cookie — or a new one, set on the way out — so the assistant knows this person next time.
  const jar = await cookies();
  const knownDevice = /^[0-9a-f-]{36}$/.test(jar.get(DEVICE_COOKIE)?.value ?? "") ? jar.get(DEVICE_COOKIE)!.value : null;
  const deviceId = knownDevice ?? randomUUID();

  let conversationId = parsed.data.conversationId ?? null;
  let existing: { messageCount: number; mode: string; awaitingSince: Date | null; lastStaffAt: Date | null; vehicleId: string | null; staffAlertedAt: Date | null } | null = null;
  if (conversationId) {
    const [row] = await db
      .select({
        messageCount: assistantConversations.messageCount,
        mode: assistantConversations.mode,
        awaitingSince: assistantConversations.awaitingSince,
        lastStaffAt: assistantConversations.lastStaffAt,
        vehicleId: assistantConversations.vehicleId,
        staffAlertedAt: assistantConversations.staffAlertedAt,
        deviceId: assistantConversations.deviceId,
      })
      .from(assistantConversations)
      .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.dealerId, dealerId)))
      .limit(1);
    // An unknown id starts afresh rather than failing: the widget keeps the id, and a stale one must never stop someone typing.
    // So does an id from another device: a chat belongs to the phone it happened on, and nobody writes into it from elsewhere.
    if (!row || (row.deviceId && row.deviceId !== knownDevice)) conversationId = null;
    else if (row.messageCount >= MAX_MESSAGES) {
      if (answer) await db.update(assistantConversations).set({ awaitingSince: null }).where(eq(assistantConversations.id, conversationId));
      return busy("We've covered a lot! Let's pick this up properly — tap “Call me back” and someone will call you.", 409);
    } else existing = row;
  }

  // "Sabi, answer now": only a room that is waiting, and only once the wait has passed with no person answering. The
  // claim is one UPDATE, so two screens asking at the same moment get one answer, not two.
  if (answer) {
    if (!conversationId || !existing || existing.mode !== "seller") return busy("That chat is not waiting for an answer.", 409);
    if (!sabiMayAnswer(existing)) return NextResponse.json({ skip: true, reason: "A person has answered, or the wait is not over." }, { status: 409 });
    const claimed = await db
      .update(assistantConversations)
      .set({ awaitingSince: null })
      .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.awaitingSince, existing.awaitingSince!)))
      .returning({ id: assistantConversations.id });
    if (!claimed.length) return NextResponse.json({ skip: true, reason: "Already being answered." }, { status: 409 });
  }

  // Referral attribution is read now, while the request's cookies are at hand — before any path files a lead.
  let partner: { id: string; phone: string } | null = null;
  try {
    partner = await activePartnerByCode(dealerId, jar.get(PARTNER_COOKIE)?.value ?? "");
  } catch {
    partner = null;
  }

  const sellerRoom = mode === "seller" || existing?.mode === "seller";
  if (!conversationId) {
    const [created] = await db
      .insert(assistantConversations)
      .values({ dealerId, landingPath: path?.slice(0, 300) ?? null, vehicleId: pageVehicle?.id ?? null, ipHash: hash, deviceId, mode: sellerRoom ? "seller" : "assistant" })
      .returning({ id: assistantConversations.id });
    conversationId = created.id;
    existing = { messageCount: 0, mode: sellerRoom ? "seller" : "assistant", awaitingSince: null, lastStaffAt: null, vehicleId: pageVehicle?.id ?? null, staffAlertedAt: null };
  } else if (mode === "seller" && existing?.mode !== "seller") {
    // A buyer who was talking to Sabi now wants a person: the same room, from here on with the team in it.
    await db.update(assistantConversations).set({ mode: "seller" }).where(eq(assistantConversations.id, conversationId));
    if (existing) existing.mode = "seller";
  }
  const convId = conversationId;
  const headers = new Headers({ "Cache-Control": "no-store" });
  // A year on the device, unreadable to scripts: it names the device to us and nothing else.
  if (!knownDevice) headers.set("Set-Cookie", `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);

  // ── A seller room: the message goes to the team, not to the model ──────
  if (sellerRoom && !answer) {
    const message = parsed.data.message!;
    const at = new Date();
    await db.insert(assistantMessages).values({ conversationId: convId, role: "user", content: sealMessage(message), createdAt: at });
    await db
      .update(assistantConversations)
      .set({ awaitingSince: at, lastMessageAt: at, messageCount: sql`${assistantConversations.messageCount} + 1` })
      .where(eq(assistantConversations.id, convId));
    const room = existing!;
    after(async () => {
      try {
        await alertStaffAboutChat({ id: convId, dealerId, vehicleId: room.vehicleId, staffAlertedAt: room.staffAlertedAt }, message, at);
        if (PHONE_IN_TEXT.test(message) || /@/.test(message)) await summariseConversation(convId, partner);
      } catch (e) {
        console.error("[assistant] alerting the team failed", e);
      }
    });
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ conversationId: convId, waitSeconds: sellerWaitSeconds(at), at: at.toISOString() }), { headers });
  }

  // ── Sabi's reply ────────────────────────────────────────────────────────
  // The message being answered: the one just sent, or — in a seller room — the one waiting.
  let history: Turn[] = [];
  let message = parsed.data.message ?? "";
  let firstReplyInRoom = false;
  if (existing && existing.messageCount > 0) {
    const rows = await db
      .select({ role: assistantMessages.role, content: assistantMessages.content })
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, convId))
      .orderBy(desc(assistantMessages.createdAt))
      .limit(HISTORY);
    const ordered = rows.reverse();
    firstReplyInRoom = !ordered.some((r) => r.role !== "user");
    history = asTurns(ordered);
    if (answer) {
      // The waiting message is the last turn of the history; the model answers it.
      const last = history.at(-1);
      if (!last || last.role !== "user") return NextResponse.json({ skip: true, reason: "Nothing is waiting." }, { status: 409 });
      message = last.content;
      history = history.slice(0, -1);
    }
  }
  const memory = knownDevice ? await buyerMemory(dealerId, knownDevice, convId, bySlug).catch(() => null) : null;
  const askedAt = new Date();

  const chunks: AsyncIterable<string> = key
    ? (async function* () {
        const stream = new Anthropic({ apiKey: key }).messages.stream({
          model: MODEL,
          max_tokens: 1000,
          system: [
            { type: "text", text: PERSONA },
            // An hour, not five minutes: on a quiet afternoon every question was a cold one, re-reading the whole stock before the first word.
            { type: "text", text: `# What you know — live from the showroom\n\n${knowledgeText}`, cache_control: { type: "ephemeral", ttl: "1h" } },
            { type: "text", text: `# Right now\n${momentContext({ path: path ?? null, vehicle: pageVehicle })}` },
            ...(sellerRoom ? [{ type: "text" as const, text: `${SELLER_ROOM}\n${firstReplyInRoom ? "No reply exists in this room yet: begin with the one short line." : "A reply already exists in this room: do not repeat the line."}` }] : []),
            ...(memory ? [{ type: "text" as const, text: `# What you remember about this person\n${memory}` }] : []),
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
        // The reply is whole. Without this a phone whose connection dropped mid-reply would show the half as the answer.
        send({ type: "done" });
      } catch (e) {
        console.error("[assistant] reply failed", e);
        failure = e;
        send({ type: "error", error: "Sorry — something went wrong on our side. Please try again, or call or WhatsApp us." });
      }

      // Saved before the stream closes, so the record never depends on the visitor staying on the page.
      try {
        if (full.trim()) {
          // In a seller room the buyer's message was saved when it was sent; here only Sabi's answer is new.
          const savedAt = new Date();
          const rows = answer
            ? [{ conversationId: convId, role: "assistant", content: sealMessage(full), createdAt: savedAt }]
            : [
                { conversationId: convId, role: "user", content: sealMessage(message), createdAt: askedAt },
                { conversationId: convId, role: "assistant", content: sealMessage(full), createdAt: savedAt },
              ];
          const [saved] = await db.insert(assistantMessages).values(rows).returning({ id: assistantMessages.id, role: assistantMessages.role });
          await db
            .update(assistantConversations)
            .set({
              messageCount: sql`${assistantConversations.messageCount} + ${rows.length}`,
              lastMessageAt: savedAt,
              vehiclesShown: sql`(select coalesce(jsonb_agg(distinct s), '[]'::jsonb) from jsonb_array_elements_text(${assistantConversations.vehiclesShown} || ${JSON.stringify(shown)}::jsonb) s)`,
            })
            .where(eq(assistantConversations.id, convId));
          // The saved row's own id and time, so the window marks what it has seen by the server's clock, never the phone's.
          const own = rows.length === 1 ? saved : null;
          send({ type: "saved", at: savedAt.toISOString(), id: own?.id ?? null });
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

  headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
  return new Response(readable, { headers });
}
