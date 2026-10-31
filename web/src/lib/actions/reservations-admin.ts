"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reservations } from "@/db/schema";
import { can, requireStaff } from "@/lib/auth";
import { normalisePhone } from "@/lib/phone";
import { completeReservation, endReservation, recordShowroomReservation } from "@/lib/reserve";

type Result = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/leads", "layout");
}

const showroom = z.object({
  vehicleId: z.uuid(),
  name: z.string().trim().min(2, "The buyer's name").max(120),
  phone: z.string().trim().min(6, "The buyer's phone number").max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]).default(""),
  /** Whole naira, typed by staff. */
  amount: z.coerce.number().int().positive("The amount, in naira"),
  channel: z.enum(["cash", "pos", "bank"]),
  note: z.string().trim().max(500).default(""),
});

/** A deposit taken in the showroom, recorded so the car is held for that buyer everywhere. */
export async function addShowroomDeposit(_prev: Result | null, formData: FormData): Promise<Result> {
  const me = await requireStaff();
  const parsed = showroom.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: z.flattenError(parsed.error).fieldErrors && Object.values(z.flattenError(parsed.error).fieldErrors).flat()[0] };
  const v = parsed.data;
  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, error: "That phone number does not look right." };
  const result = await recordShowroomReservation(me, {
    vehicleId: v.vehicleId,
    name: v.name,
    phone,
    email: v.email || null,
    amountMinor: v.amount * 100,
    channel: v.channel,
    note: v.note || null,
  });
  if (result.ok) refresh();
  return result;
}

/**
 * Cancel or refund. Refunding, and cancelling a reservation that was paid
 * (the deposit then stays with Sabicars), are a manager's call; cancelling
 * an unpaid attempt is anyone's.
 */
export async function endReservationAction(id: string, how: "cancel" | "refund", note: string): Promise<Result> {
  const me = await requireStaff();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That reservation is not here." };
  if (how === "refund" && !can.setPrices(me)) return { ok: false, error: "Only the owner or a manager can refund a deposit." };
  if (how === "cancel" && !can.setPrices(me)) {
    const [row] = await db.select({ paidAt: reservations.paidAt }).from(reservations).where(and(eq(reservations.id, id), eq(reservations.dealerId, me.dealerId))).limit(1);
    if (row?.paidAt) return { ok: false, error: "Only the owner or a manager can cancel a paid deposit (the money stays with Sabicars). Ask them, or refund it." };
  }
  const result = await endReservation(me, id, how, note.trim() || null);
  if (result.ok) refresh();
  return result;
}

/** The buyer paid the rest. */
export async function completeReservationAction(id: string): Promise<Result> {
  const me = await requireStaff();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That reservation is not here." };
  const result = await completeReservation(me, id);
  if (result.ok) refresh();
  return result;
}
