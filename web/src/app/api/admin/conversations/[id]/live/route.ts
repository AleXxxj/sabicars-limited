import { NextResponse } from "next/server";
import { describeDirectives } from "@/lib/assistant/parts";
import { isTyping, staffPresent } from "@/lib/assistant/seller";
import { threadMessagesSince, threadState } from "@/lib/assistant/seller-room";
import { can, requireStaff } from "@/lib/auth";
import { vehiclesWithPages } from "@/lib/repositories/vehicles";
import { vehicleTitle } from "@/lib/vehicle";

export const dynamic = "force-dynamic";

/**
 * What the team's screen fetches, every couple of seconds, while a chat is
 * open in the admin: every line written since the last it saw, whether the
 * buyer is waiting, whether a person is in the room, and whether the buyer
 * is typing. Staff only, and a chat with Sabi (not the team) is read by the
 * owner and managers alone, as on the page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  const room = await threadState(id, me.dealerId);
  if (!room) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  if (room.mode !== "seller" && !can.readTranscripts(me)) return NextResponse.json({ error: "Not yours to read." }, { status: 403 });

  const afterRaw = new URL(request.url).searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : null;
  const lines = await threadMessagesSince(id, after);
  // Sabi's lines carry directives naming cars; the screen reads titles, not slugs. Looked up only when one arrived.
  const titles = lines.some((l) => l.role === "assistant") ? new Map((await vehiclesWithPages(room.vehiclesShown)).map((v) => [v.slug, vehicleTitle(v)])) : null;
  const now = new Date();
  return NextResponse.json(
    {
      messages: lines.map((l) => (l.role === "assistant" ? { ...l, text: describeDirectives(l.text, (s) => titles?.get(s) ?? s), raw: l.text } : l)),
      awaiting: Boolean(room.awaitingSince),
      staffPresent: staffPresent(room.lastStaffAt, now),
      buyerTyping: isTyping(room.buyerTypingAt, now),
      messageCount: room.messageCount,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
