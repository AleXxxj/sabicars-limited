import { unsubscribe } from "@/lib/actions/subscribe";

/**
 * One-click unsubscribe from inside the mail app (RFC 8058): Gmail and others
 * POST here when the reader taps "Unsubscribe" next to the sender's name.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  await unsubscribe((await params).token);
  return new Response(null, { status: 200 });
}
