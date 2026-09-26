"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";
import { sendWelcome } from "@/lib/newsletter";

export interface SubscribeResult {
  ok: boolean;
  /** Already subscribed: said kindly, not as an error. */
  already?: boolean;
  error?: string;
  email?: string;
}

const schema = z.object({
  email: z.email("That email does not look right").max(200),
  name: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(80).optional()),
  source: z.enum(["prompt", "footer", "article", "page"]).catch("page"),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * Newsletter sign-up. Someone who unsubscribed and signs up again is simply
 * welcomed back; someone already on the list is told so, not shown an error.
 */
export async function subscribe(_prev: SubscribeResult | null, formData: FormData): Promise<SubscribeResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your email address." };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, email: v.email };

  const email = v.email.trim().toLowerCase();
  const dealerId = await sabicarsDealerId();
  const [existing] = await db
    .select({ id: subscribers.id, isActive: subscribers.isActive })
    .from(subscribers)
    .where(and(eq(subscribers.dealerId, dealerId), sql`lower(${subscribers.email}) = ${email}`))
    .limit(1);
  if (existing?.isActive) return { ok: true, already: true, email };

  let id = existing?.id;
  try {
    if (existing) {
      await db
        .update(subscribers)
        .set({ isActive: true, unsubscribedAt: null, name: v.name ?? undefined })
        .where(eq(subscribers.id, existing.id));
    } else {
      [{ id }] = await db
        .insert(subscribers)
        .values({ dealerId, email, name: v.name ?? null, source: v.source })
        .returning({ id: subscribers.id });
    }
  } catch (e) {
    console.error("[subscribe] failed", e);
    return { ok: false, error: "That did not go through. Please try again." };
  }
  const welcomeId = id!;
  after(() => sendWelcome(welcomeId).catch((e) => console.error("[subscribe] welcome failed", e)));
  revalidatePath("/admin/audience");
  return { ok: true, email };
}

/** One click, no questions, no sign-in. */
export async function unsubscribe(token: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(token).success) return { ok: false };
  const [row] = await db
    .update(subscribers)
    .set({ isActive: false, unsubscribedAt: new Date() })
    .where(eq(subscribers.unsubscribeToken, token))
    .returning({ id: subscribers.id });
  revalidatePath("/admin/audience");
  return { ok: Boolean(row) };
}

export async function resubscribe(token: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(token).success) return { ok: false };
  const [row] = await db
    .update(subscribers)
    .set({ isActive: true, unsubscribedAt: null })
    .where(eq(subscribers.unsubscribeToken, token))
    .returning({ id: subscribers.id });
  revalidatePath("/admin/audience");
  return { ok: Boolean(row) };
}
