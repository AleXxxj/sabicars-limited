import { createHash } from "node:crypto";
import { z } from "zod";
import { recordIncident } from "@/lib/incidents";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
  digest: z.string().max(100).optional(),
});

/**
 * Light abuse guard: a browser may report a handful of errors a minute;
 * anything more from one address is dropped. In memory, per instance —
 * enough to stop a loop, and the endpoint can do nothing but add a row.
 */
const PER_MINUTE = 5;
const recent = new Map<string, number[]>();
function tooMany(key: string): boolean {
  const now = Date.now();
  if (recent.size > 2_000) for (const [k, times] of recent) if (!times.some((t) => now - t < 60_000)) recent.delete(k);
  const times = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= PER_MINUTE) return true;
  times.push(now);
  recent.set(key, times);
  return false;
}

/** The browser's error boundary reporting what a visitor just hit, so it is on record before anyone complains. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(createHash("sha256").update(ip).digest("hex").slice(0, 16))) return Response.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { message, stack, path, digest } = parsed.data;
  await recordIncident({ kind: "client", message, stack: stack ?? null, path: path ?? null, digest: digest ?? null });
  return Response.json({ ok: true });
}
