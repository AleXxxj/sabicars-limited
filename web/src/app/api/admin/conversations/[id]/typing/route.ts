import { NextResponse } from "next/server";
import { z } from "zod";
import { setStaffTyping } from "@/lib/assistant/seller-room";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const body = z.object({ typing: z.boolean() });

/**
 * A person on the team is typing a reply (or stopped): their screen reports
 * every couple of seconds while they type, so the buyer's window can show
 * "typing…" under the team's name.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Could not read that." }, { status: 400 });
  const heard = await setStaffTyping(id, me.dealerId, parsed.data.typing);
  if (!heard) return NextResponse.json({ error: "No such chat." }, { status: 404 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
