import "server-only";
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, leads } from "@/db/schema";
import { CALLBACK_NAME, LEAD_STATUS_LABEL } from "@/lib/lead-labels";
import { referenceFor } from "@/lib/reference";
import type { VehicleWithCover } from "@/lib/repositories/vehicles";
import { vehicleTitle } from "@/lib/vehicle";

/** The cookie that lets the assistant know a device it has talked to before. */
export const DEVICE_COOKIE = "sc_device";
/** How far back it remembers: a car buyer's search lasts weeks, not years. */
const MEMORY_DAYS = 180;
const MAX_PAST = 4;

/** "today", "yesterday", "5 days ago", "3 weeks ago" — the way a person says when. */
function ago(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * What the assistant may remember about the person on this device: their
 * earlier conversations here, each as the summary a model wrote for staff
 * (never the transcript), the name and reference on any enquiry they left,
 * and the cars it showed them — with whether each is still in stock, so a
 * welcome back never offers a car that has gone.
 *
 * Recognition is by the device's own cookie, and only that. A phone number
 * would let anyone who typed someone else's hear what they were looking at.
 */
export async function buyerMemory(dealerId: string, deviceId: string | null, currentConversationId: string | null, bySlug: Map<string, VehicleWithCover>): Promise<string | null> {
  if (!deviceId) return null;
  const since = new Date(Date.now() - MEMORY_DAYS * 86_400_000);
  const past = await db
    .select({
      id: assistantConversations.id,
      summary: assistantConversations.summary,
      intent: assistantConversations.intent,
      vehiclesShown: assistantConversations.vehiclesShown,
      lastMessageAt: assistantConversations.lastMessageAt,
      leadId: assistantConversations.leadId,
    })
    .from(assistantConversations)
    .where(
      and(
        eq(assistantConversations.dealerId, dealerId),
        eq(assistantConversations.deviceId, deviceId),
        isNotNull(assistantConversations.summary),
        ...(currentConversationId ? [ne(assistantConversations.id, currentConversationId)] : []),
      ),
    )
    .orderBy(desc(assistantConversations.lastMessageAt))
    .limit(MAX_PAST);
  const recent = past.filter((p) => p.lastMessageAt >= since);
  if (!recent.length) return null;

  const leadIds = recent.map((p) => p.leadId).filter((id): id is string => Boolean(id));
  const theirLeads = leadIds.length
    ? await db.select({ id: leads.id, name: leads.name, status: leads.status, type: leads.type }).from(leads).where(inArray(leads.id, leadIds))
    : [];
  const name = theirLeads.find((l) => l.name && l.name !== CALLBACK_NAME)?.name ?? null;
  const now = new Date();

  const lines = recent.map((p) => {
    const cars = p.vehiclesShown
      .map((slug) => {
        const v = bySlug.get(slug);
        return v ? `${vehicleTitle(v)} (slug ${slug}, still in stock)` : `${slug} (no longer in stock)`;
      })
      .join("; ");
    const lead = theirLeads.find((l) => l.id === p.leadId);
    return [
      `- ${ago(p.lastMessageAt, now)}${p.intent ? `, wanted: ${p.intent}` : ""}. ${p.summary}`,
      cars ? `  Cars shown: ${cars}.` : null,
      lead ? `  They left an enquiry, reference ${referenceFor(lead.id)}, now marked "${LEAD_STATUS_LABEL[lead.status]}".` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    name ? `This person has told you their name before: ${name.split(" ")[0]}.` : "You do not know this person's name yet.",
    "They have chatted with you on this device before. What you remember, newest first:",
    ...lines,
  ].join("\n");
}
