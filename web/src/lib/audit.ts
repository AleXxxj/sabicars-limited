import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { StaffMember } from "@/lib/auth";

/**
 * Who changed what, and when. Written on every staff change to a record.
 *
 * Only the fields that actually changed are stored, as { field: [before, after] }
 * — a trail of whole-row dumps is too noisy for anyone to read when a price
 * dispute or a missing car needs explaining.
 */
export async function audit(
  actor: StaffMember,
  entity: string,
  entityId: string,
  action: string,
  diff?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({ dealerId: actor.dealerId, actorId: actor.id, actorEmail: actor.email, entity, entityId, action, diff: diff ?? null });
}

/** { price: [before, after] } for every key whose value differs. Dates and arrays compare by value. */
export function changes<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : JSON.stringify(v ?? null));
  for (const key of Object.keys(after)) {
    if (norm(before[key]) !== norm(after[key])) out[key] = [before[key] ?? null, after[key] ?? null];
  }
  return out;
}
