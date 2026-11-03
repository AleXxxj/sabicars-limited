import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, assistantMessages, staff, vehicles } from "@/db/schema";
import { pushToStaff } from "@/lib/alerts";
import { CHAT_ALERT_EVERY_SECONDS, shouldAlertStaff } from "@/lib/assistant/seller";
import { openMessage, sealMessage } from "@/lib/assistant/vault";
import type { StaffMember } from "@/lib/auth";
import { vehicleTitle } from "@/lib/vehicle";

/**
 * The server side of a "Chat with seller" room: who may read it, what the
 * buyer's screen fetches, what the team's screen fetches, how each side's
 * typing is heard, how staff phones are pinged, and how a person's reply is
 * written in. The rules themselves are in seller.ts.
 */

export interface RoomMessage {
  id: string;
  role: "assistant" | "staff";
  /** The first name of the person on the team who wrote it; null for Sabi. */
  name: string | null;
  text: string;
  /** ISO. */
  at: string;
}

export interface Room {
  id: string;
  dealerId: string;
  mode: string;
  awaitingSince: Date | null;
  lastStaffAt: Date | null;
  staffTypingAt: Date | null;
}

/** A line of the chat as the team's screen shows it: every side, in the open. */
export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "staff";
  /** The words, opened; Sabi's still carry its [[directives]], which the screen describes. */
  text: string;
  /** The first name of the person on the team who wrote it, on a staff line. */
  staffName: string | null;
  /** ISO. */
  at: string;
}

/**
 * Lines written at or after `after`. A screen asks with the time of the newest line it has, to the millisecond
 * (ISO), while the database keeps microseconds: "strictly after" would hand that newest line back for ever,
 * and "after the next millisecond" could skip a line written in the same one. So the database's time is read
 * to the millisecond and compared inclusively, and every screen drops lines it already has by id.
 */
function since(after: Date | null) {
  // As text, cast: a raw fragment hands the driver a Date it cannot send, where a column comparison would convert it.
  return after ? sql`date_trunc('milliseconds', ${assistantMessages.createdAt}) >= ${after.toISOString()}::timestamptz` : sql`true`;
}

/** The first name a buyer sees on a staff message; a member with no name on file is "the team", never an email handle. */
export function staffFirstName(person: { fullName: string | null; email?: string | null }): string {
  return person.fullName?.trim().split(/\s+/)[0] || "Sabicars team";
}

/**
 * The room, for the device that opened it and no other: the buyer's device
 * cookie must match the one the conversation was started with. A chat is
 * private to the phone it happened on.
 */
export async function roomFor(conversationId: string, deviceId: string | null): Promise<Room | null> {
  if (!deviceId) return null;
  const [row] = await db
    .select({
      id: assistantConversations.id,
      dealerId: assistantConversations.dealerId,
      mode: assistantConversations.mode,
      awaitingSince: assistantConversations.awaitingSince,
      lastStaffAt: assistantConversations.lastStaffAt,
      staffTypingAt: assistantConversations.staffTypingAt,
    })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.deviceId, deviceId)))
    .limit(1);
  return row ?? null;
}

/** The replies — Sabi's and the team's — written after `after`, oldest first, for the buyer's screen. */
export async function roomMessagesSince(conversationId: string, after: Date | null): Promise<RoomMessage[]> {
  const rows = await db
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      createdAt: assistantMessages.createdAt,
      fullName: staff.fullName,
      email: staff.email,
    })
    .from(assistantMessages)
    .leftJoin(staff, eq(staff.id, assistantMessages.staffId))
    .where(and(eq(assistantMessages.conversationId, conversationId), sql`${assistantMessages.role} <> 'user'`, since(after)))
    .orderBy(asc(assistantMessages.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    role: r.role === "staff" ? "staff" : "assistant",
    name: r.role === "staff" ? staffFirstName({ fullName: r.fullName, email: r.email }) : null,
    text: openMessage(r.content),
    at: r.createdAt.toISOString(),
  }));
}

/**
 * The buyer's keyboard was heard from (or fell silent): noted on the room, so
 * the team's screen can show it. Only the device that opened the room counts.
 */
export async function setBuyerTyping(conversationId: string, deviceId: string | null, typing: boolean, now = new Date()): Promise<boolean> {
  if (!deviceId) return false;
  const rows = await db
    .update(assistantConversations)
    .set({ buyerTypingAt: typing ? now : null })
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.deviceId, deviceId)))
    .returning({ id: assistantConversations.id });
  return rows.length > 0;
}

/** A person on the team is typing a reply (or stopped): noted on the room, so the buyer's screen can show it. */
export async function setStaffTyping(conversationId: string, dealerId: string, typing: boolean, now = new Date()): Promise<boolean> {
  const rows = await db
    .update(assistantConversations)
    .set({ staffTypingAt: typing ? now : null })
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.dealerId, dealerId)))
    .returning({ id: assistantConversations.id });
  return rows.length > 0;
}

/** The room as the team's screen follows it: whether the buyer waits, a person is in, the buyer is typing. */
export async function threadState(conversationId: string, dealerId: string) {
  const [row] = await db
    .select({
      id: assistantConversations.id,
      mode: assistantConversations.mode,
      awaitingSince: assistantConversations.awaitingSince,
      lastStaffAt: assistantConversations.lastStaffAt,
      buyerTypingAt: assistantConversations.buyerTypingAt,
      staffTypingAt: assistantConversations.staffTypingAt,
      messageCount: assistantConversations.messageCount,
      vehiclesShown: assistantConversations.vehiclesShown,
    })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.dealerId, dealerId)))
    .limit(1);
  return row ?? null;
}

/** Every line written after `after`, oldest first, for the team's screen. */
export async function threadMessagesSince(conversationId: string, after: Date | null): Promise<ThreadMessage[]> {
  const rows = await db
    .select({
      id: assistantMessages.id,
      role: assistantMessages.role,
      content: assistantMessages.content,
      createdAt: assistantMessages.createdAt,
      fullName: staff.fullName,
      email: staff.email,
    })
    .from(assistantMessages)
    .leftJoin(staff, eq(staff.id, assistantMessages.staffId))
    .where(and(eq(assistantMessages.conversationId, conversationId), since(after)))
    .orderBy(asc(assistantMessages.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    role: r.role === "staff" ? "staff" : r.role === "user" ? "user" : "assistant",
    text: openMessage(r.content),
    staffName: r.role === "staff" ? staffFirstName({ fullName: r.fullName, email: r.email }) : null,
    at: r.createdAt.toISOString(),
  }));
}

/**
 * Pings the phones of everyone on the team who takes alerts: every line the
 * buyer sends, merged within a few seconds so a fast typist is one ping. The
 * claim is one UPDATE, so two messages arriving together ping once.
 */
export async function alertStaffAboutChat(
  conversation: { id: string; dealerId: string; vehicleId: string | null; staffAlertedAt: Date | null },
  text: string,
  now = new Date(),
): Promise<{ sent: number }> {
  if (!shouldAlertStaff(conversation.staffAlertedAt, now)) return { sent: 0 };
  const before = new Date(now.getTime() - CHAT_ALERT_EVERY_SECONDS * 1000);
  const claimed = await db
    .update(assistantConversations)
    .set({ staffAlertedAt: now })
    .where(
      and(
        eq(assistantConversations.id, conversation.id),
        or(isNull(assistantConversations.staffAlertedAt), lt(assistantConversations.staffAlertedAt, before)),
      ),
    )
    .returning({ id: assistantConversations.id });
  if (!claimed.length) return { sent: 0 };

  const [vehicle] = conversation.vehicleId
    ? await db
        .select({ year: vehicles.year, make: vehicles.make, model: vehicles.model })
        .from(vehicles)
        .where(eq(vehicles.id, conversation.vehicleId))
        .limit(1)
    : [];
  const people = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.dealerId, conversation.dealerId), eq(staff.isActive, true), eq(staff.receivesAlerts, true)));
  const push = await pushToStaff(
    people.map((p) => p.id),
    {
      title: vehicle ? `Chat about the ${vehicleTitle(vehicle)}` : "A buyer wants to chat",
      body: text.length > 140 ? `${text.slice(0, 137)}…` : text,
      url: `/admin/conversations/${conversation.id}`,
      tag: `chat:${conversation.id}`,
    },
  );
  // Nothing reached a phone: give the claim back, so the buyer's next line tries again rather than waiting out the throttle.
  if (push.sent === 0 && push.failed > 0) {
    await db
      .update(assistantConversations)
      .set({ staffAlertedAt: conversation.staffAlertedAt })
      .where(and(eq(assistantConversations.id, conversation.id), eq(assistantConversations.staffAlertedAt, now)));
  }
  return { sent: push.sent };
}

/**
 * A room whose buyer left before anyone answered must not sit in the
 * "Waiting for a person" list for ever: after a day, it stops waiting.
 * Run from an hourly job; harmless to run more often.
 */
export async function releaseStaleRooms(now = new Date()): Promise<number> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db
    .update(assistantConversations)
    .set({ awaitingSince: null })
    .where(and(isNotNull(assistantConversations.awaitingSince), lt(assistantConversations.awaitingSince, dayAgo)))
    .returning({ id: assistantConversations.id });
  return rows.length;
}

/**
 * A person's reply, written into the room: sealed like every message, under
 * their name. The room stops waiting, their typing sign drops, and Sabi stays
 * quiet while they are in it.
 */
export async function staffReply(me: StaffMember, conversationId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [conversation] = await db
    .select({ id: assistantConversations.id, mode: assistantConversations.mode })
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.dealerId, me.dealerId)))
    .limit(1);
  if (!conversation) return { ok: false, error: "That chat is not here any more." };
  if (conversation.mode !== "seller") return { ok: false, error: "The buyer is talking to Sabi, not waiting for a person. Their phone is not listening for a reply here." };
  const now = new Date();
  await db.insert(assistantMessages).values({ conversationId, role: "staff", content: sealMessage(text), staffId: me.id, createdAt: now });
  await db
    .update(assistantConversations)
    .set({
      lastStaffAt: now,
      awaitingSince: null,
      staffTypingAt: null,
      needsHuman: false,
      lastMessageAt: now,
      messageCount: sql`${assistantConversations.messageCount} + 1`,
    })
    .where(eq(assistantConversations.id, conversationId));
  return { ok: true };
}
