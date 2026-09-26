"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { requestMatches, vehicleRequests, vehicleWatches } from "@/db/schema";
import { audit, changes } from "@/lib/audit";
import { requireStaff } from "@/lib/auth";

const updateSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["open", "sourcing", "matched", "fulfilled", "closed"]),
  staffNote: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(1000).nullable()),
});

/**
 * Staff's judgement on a request: whether the buyer is serious enough to
 * source for, and what has been tried. Every change is audited.
 */
export async function updateRequest(_prev: { ok: boolean; error?: string } | null, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const me = await requireStaff();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "That change could not be saved." };
  const { requestId, status, staffNote } = parsed.data;

  const [before] = await db
    .select()
    .from(vehicleRequests)
    .where(and(eq(vehicleRequests.id, requestId), eq(vehicleRequests.dealerId, me.dealerId)))
    .limit(1);
  if (!before) return { ok: false, error: "That request no longer exists." };

  const next = { status, staffNote };
  const diff = changes(before as unknown as Record<string, unknown>, next);
  if (!Object.keys(diff).length) return { ok: true };
  await db.update(vehicleRequests).set({ ...next, updatedAt: new Date() }).where(eq(vehicleRequests.id, requestId));
  await audit(me, "vehicle_request", requestId, diff.status ? "status_change" : "update", diff);
  revalidatePath("/admin/requests");
  return { ok: true };
}

/** A staff member sent the match themselves (the board's WhatsApp button). */
export async function markMatchSent(matchId: string): Promise<{ ok: boolean }> {
  const me = await requireStaff();
  const [m] = await db
    .select({ id: requestMatches.id, status: requestMatches.status })
    .from(requestMatches)
    .innerJoin(vehicleRequests, eq(vehicleRequests.id, requestMatches.requestId))
    .where(and(eq(requestMatches.id, matchId), eq(vehicleRequests.dealerId, me.dealerId)))
    .limit(1);
  if (!m) return { ok: false };
  if (m.status === "sent") return { ok: true };
  await db.update(requestMatches).set({ status: "sent", channel: "staff", sentAt: new Date(), error: null }).where(eq(requestMatches.id, matchId));
  await audit(me, "request_match", matchId, "status_change", { status: [m.status, "sent"], channel: [null, "staff"] });
  revalidatePath("/admin/requests");
  return { ok: true };
}

/** A staff member told a watcher about a price drop themselves. */
export async function markPriceDropSent(watchId: string): Promise<{ ok: boolean }> {
  const me = await requireStaff();
  const [w] = await db
    .select({ id: vehicleWatches.id, status: vehicleWatches.alertStatus, pending: vehicleWatches.pendingPriceMinor })
    .from(vehicleWatches)
    .where(and(eq(vehicleWatches.id, watchId), eq(vehicleWatches.dealerId, me.dealerId)))
    .limit(1);
  if (!w || !w.pending) return { ok: false };
  if (w.status === "sent") return { ok: true };
  await db
    .update(vehicleWatches)
    .set({ alertStatus: "sent", alertChannel: "staff", alertedAt: new Date(), alertError: null, knownPriceMinor: w.pending })
    .where(eq(vehicleWatches.id, watchId));
  await audit(me, "vehicle_watch", watchId, "status_change", { alertStatus: [w.status, "sent"], alertChannel: [null, "staff"] });
  revalidatePath("/admin/requests");
  return { ok: true };
}
