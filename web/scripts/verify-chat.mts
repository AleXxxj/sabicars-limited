/**
 * The team's side of a "Chat with seller" room, proven against a real
 * database (the local one): the feed the admin screen follows, typing noted
 * both ways and only by the right party, a person's reply, and the alert
 * window that merges a fast typist's lines into one ring.
 *
 * Needs the local database (npm run db:local) and one active member of staff
 * in it. Writes one room and deletes it again.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/verify-chat.mts
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { assistantConversations, assistantMessages, staff } from "../src/db/schema";
import { CHAT_ALERT_EVERY_SECONDS, isTyping } from "../src/lib/assistant/seller";
import {
  alertStaffAboutChat,
  roomFor,
  roomMessagesSince,
  setBuyerTyping,
  setStaffTyping,
  staffReply,
  threadMessagesSince,
  threadState,
} from "../src/lib/assistant/seller-room";
import { sealMessage } from "../src/lib/assistant/vault";

let passed = 0;
let failed = 0;
const eq_ = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const [me] = await db.select().from(staff).where(eq(staff.isActive, true)).limit(1);
if (!me) throw new Error("No active member of staff in the database to reply as.");
const device = randomUUID();
const [conv] = await db
  .insert(assistantConversations)
  .values({ dealerId: me.dealerId, deviceId: device, mode: "seller", landingPath: "/vehicles/verify-chat", awaitingSince: new Date(), messageCount: 1 })
  .returning({ id: assistantConversations.id });
await db.insert(assistantMessages).values({ conversationId: conv.id, role: "user", content: sealMessage("Is this car still available?") });

try {
  console.log("\nThe team's feed");
  const thread = await threadMessagesSince(conv.id, null);
  eq_("shows the buyer's line, in the open", thread.map((l) => [l.role, l.text]), [["user", "Is this car still available?"]]);
  // Asked from the newest line's time (to the millisecond), the feed hands back that line and nothing else: a screen
  // drops it by id, and a line written in the same millisecond could never be missed.
  eq_("asked from its newest line, returns that line alone", (await threadMessagesSince(conv.id, new Date(thread[0].at))).map((l) => l.id), [thread[0].id]);

  console.log("\nTyping");
  eq_("a person typing is noted on the room", await setStaffTyping(conv.id, me.dealerId, true), true);
  eq_("the buyer's room reports the person typing", isTyping((await roomFor(conv.id, device))?.staffTypingAt), true);
  eq_("another dealer cannot mark a person typing", await setStaffTyping(conv.id, randomUUID(), true), false);
  eq_("the buyer typing is noted on the room", await setBuyerTyping(conv.id, device, true), true);
  eq_("the team's feed reports the buyer typing", isTyping((await threadState(conv.id, me.dealerId))?.buyerTypingAt), true);
  eq_("a stranger's device cannot mark the buyer typing", await setBuyerTyping(conv.id, randomUUID(), true), false);
  await setBuyerTyping(conv.id, device, false);
  eq_("the buyer stopping clears it", (await threadState(conv.id, me.dealerId))?.buyerTypingAt ?? null, null);

  console.log("\nA person's reply");
  eq_("is written in", (await staffReply(me, conv.id, "Yes, it is at the showroom today.")).ok, true);
  const after = await roomMessagesSince(conv.id, new Date(thread[0].at));
  eq_("reaches the buyer's room under a first name", after.map((m) => [m.role, m.text, typeof m.name]), [["staff", "Yes, it is at the showroom today.", "string"]]);
  const state = await threadState(conv.id, me.dealerId);
  eq_("stops the wait and drops the person's typing sign", [state?.awaitingSince ?? null, state?.staffTypingAt ?? null], [null, null]);

  console.log("\nAlerts");
  const t0 = new Date();
  const at = async () => (await db.select({ at: assistantConversations.staffAlertedAt }).from(assistantConversations).where(eq(assistantConversations.id, conv.id)))[0].at?.getTime() ?? null;
  await alertStaffAboutChat({ id: conv.id, dealerId: me.dealerId, vehicleId: null, staffAlertedAt: null }, "line one", t0);
  eq_("the first line claims the alert window", await at(), t0.getTime());
  await alertStaffAboutChat({ id: conv.id, dealerId: me.dealerId, vehicleId: null, staffAlertedAt: new Date(t0) }, "line two", new Date(t0.getTime() + 10_000));
  eq_("a second line ten seconds later rings nobody again", await at(), t0.getTime());
  const t3 = new Date(t0.getTime() + (CHAT_ALERT_EVERY_SECONDS + 1) * 1000);
  await alertStaffAboutChat({ id: conv.id, dealerId: me.dealerId, vehicleId: null, staffAlertedAt: new Date(t0) }, "line three", t3);
  eq_(`a line after ${CHAT_ALERT_EVERY_SECONDS} seconds rings again`, await at(), t3.getTime());
} finally {
  await db.delete(assistantMessages).where(eq(assistantMessages.conversationId, conv.id));
  await db.delete(assistantConversations).where(eq(assistantConversations.id, conv.id));
}

console.log(`\n${passed} passed, ${failed} failed.${failed ? "" : "  \x1b[32mChat verified.\x1b[0m"}`);
process.exit(failed ? 1 : 0);
