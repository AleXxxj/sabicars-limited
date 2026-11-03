import { isOpen } from "@/lib/showroom-hours";

/**
 * "Chat with seller": the rules of a room where the buyer asked for the team.
 *
 * A person is meant to answer. Staff phones are pinged the moment the buyer
 * writes, and a salesperson replies from the admin. But a buyer must never
 * sit in a silent room: if nobody is free within the typical wait, Sabi, the
 * assistant, answers and says the team has been told. When the showroom is
 * closed there is no wait at all — nobody is coming, and the buyer is told so.
 * A person can join at any point and take over; Sabi then stays quiet while
 * that person is in the room.
 *
 * Plain functions, so the browser (the wait timer) and the server (who may
 * answer) can never disagree about the rules.
 */

/** How long a buyer waits for a person during opening hours before Sabi answers. */
export const SELLER_WAIT_SECONDS = 75;
/** A person who wrote within this many minutes is "in the room": Sabi does not answer over them. */
export const STAFF_PRESENCE_MINUTES = 10;
/**
 * Staff phones are pinged about a chat at most this often: every line the buyer sends rings, but a fast typist
 * sending three lines in ten seconds is one ring, not three. The phone's notification replaces itself (same
 * tag) and re-alerts, so each ring is the latest line.
 */
export const CHAT_ALERT_EVERY_SECONDS = 20;
/**
 * "Typing…" shows for this long after the last word was heard from a keyboard. Each side reports its typing
 * every couple of seconds while it goes on, so the sign stays up through a pause and drops soon after a stop.
 */
export const TYPING_TTL_SECONDS = 6;
/** The buyer's timer and the server's clock will not agree to the second. */
const GRACE_SECONDS = 5;

/** The wait before Sabi answers: the typical wait while the showroom is open, none when it is closed. */
export function sellerWaitSeconds(now = new Date()): number {
  return isOpen(now) ? SELLER_WAIT_SECONDS : 0;
}

/** True while a person on the team has written recently enough to count as present. */
export function staffPresent(lastStaffAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(lastStaffAt && now.getTime() - lastStaffAt.getTime() < STAFF_PRESENCE_MINUTES * 60_000);
}

/** True when staff phones may be pinged again about this chat. */
export function shouldAlertStaff(staffAlertedAt: Date | null | undefined, now = new Date()): boolean {
  return !staffAlertedAt || now.getTime() - staffAlertedAt.getTime() >= CHAT_ALERT_EVERY_SECONDS * 1000;
}

/** True while a keyboard last heard from at `typingAt` still counts as typing. */
export function isTyping(typingAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(typingAt && now.getTime() - typingAt.getTime() < TYPING_TTL_SECONDS * 1000);
}

/**
 * Whether Sabi may answer the buyer's waiting message now: there is one, no
 * person has answered it, and the wait that applied when it was sent has
 * passed (with a little grace for clocks).
 */
export function sabiMayAnswer(
  room: { awaitingSince: Date | null | undefined; lastStaffAt: Date | null | undefined },
  now = new Date(),
): boolean {
  if (!room.awaitingSince) return false;
  if (room.lastStaffAt && room.lastStaffAt >= room.awaitingSince) return false;
  const waited = (now.getTime() - room.awaitingSince.getTime()) / 1000;
  return waited + GRACE_SECONDS >= sellerWaitSeconds(room.awaitingSince);
}

/** How many seconds of the wait are left for a message sent at `awaitingSince`; zero once Sabi may answer. */
export function remainingWaitSeconds(awaitingSince: Date, now = new Date()): number {
  const elapsed = (now.getTime() - awaitingSince.getTime()) / 1000;
  return Math.max(0, Math.ceil(sellerWaitSeconds(awaitingSince) - elapsed));
}

/** What the buyer is told while the room waits for a person. */
export function waitingLine(waitSeconds: number): string {
  if (waitSeconds === 0) return "The showroom is closed now. Sabi answers right away, and the team sees your chat when it opens.";
  return "Sent to the team. If nobody is free in about a minute, Sabi answers.";
}
