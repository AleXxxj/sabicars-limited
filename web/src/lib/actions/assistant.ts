"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantMessages } from "@/db/schema";
import { escalateStaleLeads, notifyNewLead } from "@/lib/alerts";
import { attachLead, summariseConversation } from "@/lib/assistant/summarise";
import { DECOY_REFERENCE, looksAutomated, referenceFor, sabicarsDealerId, saveLead, tooManyFrom } from "@/lib/leads";
import { activePartnerByCode, PARTNER_COOKIE } from "@/lib/partners";
import { normalisePhone } from "@/lib/phone";

export interface CallbackResult {
  ok: boolean;
  reference?: string;
  error?: string;
}

const schema = z.object({
  conversationId: z.uuid().nullish(),
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().min(7, "Please enter a phone number we can call").max(30),
  path: z.string().max(300).nullish(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * "Have someone call me", from inside Ask Sabicars. The chat's lead is filed
 * (or, if the buyer already gave their details, updated) and staff are alerted
 * like any other enquiry — with the conversation summarised, so whoever calls
 * knows what was said.
 */
export async function requestCallback(input: z.input<typeof schema>): Promise<CallbackResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE };
  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, error: "That number doesn’t look right — a Nigerian mobile, or include the country code." };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have your request — someone will call you shortly." };

  const dealerId = await sabicarsDealerId();
  const [conversation] = v.conversationId
    ? await db
        .select()
        .from(assistantConversations)
        .where(and(eq(assistantConversations.id, v.conversationId), eq(assistantConversations.dealerId, dealerId)))
        .limit(1)
    : [];

  if (!conversation) {
    const reference = await saveLead({
      dealerId,
      type: "contact",
      channel: "assistant",
      name: v.name,
      phone,
      preferredContact: "phone",
      message: "[Ask Sabicars] Asked for a call back.",
      landingPath: v.path?.slice(0, 300) ?? null,
    });
    return { ok: true, reference };
  }

  // Until the summary arrives, the buyer's own words tell staff what the call is about.
  const said = await db
    .select({ content: assistantMessages.content })
    .from(assistantMessages)
    .where(and(eq(assistantMessages.conversationId, conversation.id), eq(assistantMessages.role, "user")))
    .orderBy(asc(assistantMessages.createdAt))
    .limit(6);
  const partner = await activePartnerByCode(dealerId, (await cookies()).get(PARTNER_COOKIE)?.value ?? "").catch(() => null);
  const filed = await attachLead(conversation.id, {
    dealerId,
    name: v.name,
    phone,
    email: null,
    vehicleId: conversation.vehicleId,
    message: `[Ask Sabicars] Asked for a call back.${said.length ? `\n\nThey asked: ${said.map((s) => `“${s.content.slice(0, 200)}”`).join(" · ")}` : ""}`,
    type: "question",
    landingPath: conversation.landingPath,
    partnerId: partner && partner.phone !== phone ? partner.id : null,
  });
  if (!filed) return { ok: false, error: "Something went wrong — please call or WhatsApp us." };
  await db.update(assistantConversations).set({ needsHuman: true }).where(eq(assistantConversations.id, conversation.id));

  after(async () => {
    try {
      if (filed.created) {
        await notifyNewLead(filed.leadId);
        await escalateStaleLeads();
      }
      if (said.length) await summariseConversation(conversation.id);
    } catch (e) {
      console.error("[assistant] callback follow-up failed", e);
    }
  });
  return { ok: true, reference: referenceFor(filed.leadId) };
}
