import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { alertManagers } from "@/lib/alerts";

const ALERTED_KEY = "assistant_down_alerted_at";
/** Once every six hours at most: a reminder, not a flood. */
const QUIET_MS = 6 * 60 * 60 * 1000;

/**
 * A failure that will not fix itself — no credit, a deleted key, a wrong
 * model name — described so the owner knows what to do. Busy or briefly
 * unavailable servers are not reported: the next message usually works.
 */
export function lastingFailure(e: unknown): string | null {
  const status = (e as { status?: number })?.status;
  const message = e instanceof Error ? e.message : String(e);
  if (/credit balance/i.test(message))
    return "The Anthropic account has run out of credit. Top it up at console.anthropic.com → Settings → Billing.";
  if (status === 401) return "Anthropic rejected the API key — it may have been deleted. Create a new key and replace ANTHROPIC_API_KEY.";
  if (status === 403) return "Anthropic refused the request. Check the API key's permissions at console.anthropic.com.";
  if (status === 404) return "Anthropic does not recognise the model name. Check ASSISTANT_MODEL, or remove it to use the default.";
  return null;
}

/**
 * Ask Sabicars has stopped answering and will not start again by itself:
 * the owner and managers hear about it at once, rather than from a buyer.
 * Meanwhile the chat asks buyers to call or WhatsApp.
 */
export async function reportAssistantFailure(dealerId: string, e: unknown): Promise<void> {
  const reason = lastingFailure(e);
  if (!reason) return;
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.dealerId, dealerId), eq(settings.key, ALERTED_KEY)))
    .limit(1);
  const last = typeof row?.value === "string" ? Date.parse(row.value) : NaN;
  if (Number.isFinite(last) && Date.now() - last < QUIET_MS) return;
  await db
    .insert(settings)
    .values({ dealerId, key: ALERTED_KEY, value: new Date().toISOString() })
    .onConflictDoUpdate({ target: [settings.dealerId, settings.key], set: { value: new Date().toISOString(), updatedAt: new Date() } });
  await alertManagers(dealerId, {
    title: "Ask Sabicars has stopped answering",
    body: `${reason} Until then, buyers who use the chat are asked to call or WhatsApp.`,
    url: "/admin/conversations",
    tag: "assistant-down",
    action: "Open Conversations",
  });
}
