import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_COOKIE } from "@/lib/assistant/memory";
import { remainingWaitSeconds, sellerWaitSeconds, staffPresent } from "@/lib/assistant/seller";
import { roomFor, roomMessagesSince } from "@/lib/assistant/seller-room";

export const dynamic = "force-dynamic";

/**
 * What the buyer's chat window fetches while it waits in a "Chat with seller"
 * room: the team's replies (and Sabi's) since the last it saw, and whether a
 * person is in the room. Only the device that opened the chat may read it —
 * its cookie must match — so a chat id alone opens nothing.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  const jar = await cookies();
  const device = jar.get(DEVICE_COOKIE)?.value ?? null;
  const room = await roomFor(id, device);
  if (!room) return NextResponse.json({ error: "No such chat." }, { status: 404 });

  const afterRaw = new URL(request.url).searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : null;
  const messages = await roomMessagesSince(id, after);
  const now = new Date();
  return NextResponse.json(
    {
      messages,
      awaiting: Boolean(room.awaitingSince),
      /** Seconds left before Sabi may answer the waiting message; a reloaded window re-arms its timer from this. */
      remainingSeconds: room.awaitingSince ? remainingWaitSeconds(room.awaitingSince, now) : 0,
      staffPresent: staffPresent(room.lastStaffAt, now),
      waitSeconds: sellerWaitSeconds(now),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
