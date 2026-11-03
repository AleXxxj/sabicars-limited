import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICE_COOKIE } from "@/lib/assistant/memory";
import { setBuyerTyping } from "@/lib/assistant/seller-room";

export const dynamic = "force-dynamic";

const body = z.object({ typing: z.boolean() });

/**
 * The buyer's keyboard, heard: their chat window reports every couple of
 * seconds while they type in a "Chat with seller" room, and once more when
 * they stop, so the team's screen can show "typing…". Only the device that
 * opened the chat is heard — its cookie must match.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Could not read that." }, { status: 400 });
  const jar = await cookies();
  const heard = await setBuyerTyping(id, jar.get(DEVICE_COOKIE)?.value ?? null, parsed.data.typing);
  if (!heard) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
