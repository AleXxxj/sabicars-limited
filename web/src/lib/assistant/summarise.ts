import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, assistantMessages, leads, vehicles } from "@/db/schema";
import { escalateStaleLeads, notifyNewLead } from "@/lib/alerts";
import { normalisePhone } from "@/lib/phone";
import { describeDirectives } from "./parts";
import { SUMMARY_PROMPT } from "./prompt";

/** A small, fast model: this is extraction from a transcript, not conversation. */
const SUMMARY_MODEL = process.env.ASSISTANT_SUMMARY_MODEL ?? "claude-haiku-4-5-20251001";

interface Extracted {
  intent?: string | null;
  summary?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  vehicle?: string | null;
  wantsViewing?: boolean;
  needsHuman?: boolean;
}

/** Models wrap JSON in prose often enough that this is worth doing carefully. */
function parseJson(raw: string): Extracted | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Extracted;
  } catch {
    return null;
  }
}

const cleanEmail = (e: string | null | undefined) =>
  e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? e.trim().toLowerCase().slice(0, 200) : null;

/** A Nigerian mobile number, as people type one into a chat. */
export const PHONE_IN_TEXT = /(?:\+?234|0)\s*[789][01](?:[\s-]*\d){8}/;

/**
 * Turns a conversation into something a salesperson can act on, and — once
 * the buyer has given a name and a way to reach them — into a lead in the one
 * inbox, alerted like any other. A chat that continues updates its lead; it
 * never files a second one.
 *
 * Runs after the buyer already has their reply. If it fails, the transcript is
 * still on record: the summary is a convenience on top of it, never the record.
 */
export async function summariseConversation(conversationId: string, partner: { id: string; phone: string } | null = null): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;
  const [conversation] = await db.select().from(assistantConversations).where(eq(assistantConversations.id, conversationId)).limit(1);
  if (!conversation) return;
  const rows = await db
    .select({ role: assistantMessages.role, content: assistantMessages.content })
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, conversationId))
    .orderBy(asc(assistantMessages.createdAt));
  if (!rows.length) return;

  const transcript = rows.map((r) => `${r.role === "assistant" ? "Assistant" : "Buyer"}: ${describeDirectives(r.content)}`).join("\n");

  let extracted: Extracted | null = null;
  if (key) {
    try {
      const response = await new Anthropic({ apiKey: key }).messages.create({
        model: SUMMARY_MODEL,
        max_tokens: 600,
        system: SUMMARY_PROMPT,
        messages: [{ role: "user", content: transcript }],
      });
      extracted = parseJson(response.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
    } catch (e) {
      console.error("[assistant] summarise failed", e);
    }
  } else {
    // Without a model (local development) a phone number typed in the chat still becomes a lead.
    const said = rows.filter((r) => r.role === "user").map((r) => r.content);
    const phone = said.map((t) => PHONE_IN_TEXT.exec(t)?.[0]).find(Boolean) ?? null;
    extracted = {
      intent: "Website chat",
      summary: `Buyer said: ${said.join(" / ").slice(0, 600)}`,
      phone,
      name: phone ? "Website visitor" : null,
    };
  }
  if (!extracted?.summary) return;

  await db
    .update(assistantConversations)
    .set({
      summary: extracted.summary.slice(0, 4000),
      intent: extracted.intent?.slice(0, 200) ?? null,
      needsHuman: conversation.needsHuman || Boolean(extracted.needsHuman),
      summarisedAt: new Date(),
    })
    .where(eq(assistantConversations.id, conversationId));

  const phone = extracted.phone ? normalisePhone(extracted.phone) : null;
  const email = cleanEmail(extracted.email);
  const name = extracted.name?.trim().slice(0, 120) || null;

  let vehicleId: string | null = conversation.vehicleId;
  if (extracted.vehicle && /^[a-z0-9-]+$/.test(extracted.vehicle)) {
    const [v] = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.dealerId, conversation.dealerId), eq(vehicles.slug, extracted.vehicle)))
      .limit(1);
    vehicleId = v?.id ?? vehicleId;
  }
  const message = `[Ask Sabicars] ${extracted.intent ?? "Website chat"}\n\n${extracted.summary}`.slice(0, 4000);

  if (!name || (!phone && !email)) {
    // Details given through the callback form are not in the transcript: keep that lead's note current.
    if (conversation.leadId) {
      await db
        .update(leads)
        .set({ message, vehicleId: vehicleId ?? undefined, updatedAt: new Date() })
        .where(and(eq(leads.id, conversation.leadId), inArray(leads.status, ["new", "contacted", "qualified"])));
    }
    return;
  }

  const filed = await attachLead(conversationId, {
    dealerId: conversation.dealerId,
    name,
    phone,
    email,
    vehicleId,
    message,
    type: extracted.wantsViewing ? "viewing" : "question",
    landingPath: conversation.landingPath,
    // A partner chatting through their own link is not their own referral.
    partnerId: partner && partner.phone !== phone ? partner.id : null,
  });
  if (filed?.created) {
    await notifyNewLead(filed.leadId);
    await escalateStaleLeads();
  }
}

/**
 * Files the conversation's lead, or updates the one it already has. The
 * conversation row is locked while this runs, so two replies summarised at
 * once cannot file two leads for one buyer. `created` tells the caller to
 * alert staff — once, for a new lead only.
 */
export async function attachLead(
  conversationId: string,
  lead: {
    dealerId: string;
    name: string;
    phone: string | null;
    email: string | null;
    vehicleId: string | null;
    message: string;
    type: "question" | "viewing";
    landingPath: string | null;
    partnerId: string | null;
  },
): Promise<{ leadId: string; created: boolean } | null> {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ leadId: assistantConversations.leadId })
      .from(assistantConversations)
      .where(eq(assistantConversations.id, conversationId))
      .for("update");
    if (!c) return null;
    if (c.leadId) {
      const [existing] = await tx.select({ status: leads.status }).from(leads).where(eq(leads.id, c.leadId)).limit(1);
      // A lead staff have already closed is theirs; the chat does not reopen or rewrite it.
      if (existing && !["won", "lost"].includes(existing.status)) {
        await tx
          .update(leads)
          .set({
            name: lead.name,
            phone: lead.phone ?? undefined,
            email: lead.email ?? undefined,
            message: lead.message,
            vehicleId: lead.vehicleId ?? undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(leads.id, c.leadId), inArray(leads.status, ["new", "contacted", "qualified"])));
      }
      return { leadId: c.leadId, created: false };
    }
    const [row] = await tx
      .insert(leads)
      .values({
        dealerId: lead.dealerId,
        type: lead.type,
        channel: "assistant",
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        vehicleId: lead.vehicleId,
        message: lead.message,
        preferredContact: lead.phone ? "phone" : "email",
        landingPath: lead.landingPath,
        partnerId: lead.partnerId,
      })
      .returning({ id: leads.id });
    await tx.update(assistantConversations).set({ leadId: row.id }).where(eq(assistantConversations.id, conversationId));
    return { leadId: row.id, created: true };
  });
}
