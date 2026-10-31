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
/** Staff phones are pinged about a chat at most this often, so a fast typist is one alert, not ten. */
export const CHAT_ALERT_EVERY_MINUTES = 2;
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
  return !staffAlertedAt || now.getTime() - staffAlertedAt.getTime() >= CHAT_ALERT_EVERY_MINUTES * 60_000;
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
