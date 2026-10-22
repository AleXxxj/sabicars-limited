"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { can, requireStaff } from "@/lib/auth";
import { resolveIncident } from "@/lib/incidents";

/**
 * What a manager does from the status page. The incident core
 * (lib/incidents.ts) keeps the record; this file checks who is asking and
 * refreshes the pages that show the count.
 */

export interface OpsActionResult {
  ok: boolean;
  error?: string;
}

/** Marks an error dealt with. If the same error happens again it reopens on the same row, so nothing is lost by resolving early. */
export async function resolveIncidentAction(id: string): Promise<OpsActionResult> {
  const me = await requireStaff();
  if (!can.seeMoney(me)) return { ok: false, error: "Only a manager or the owner can resolve an error." };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That error is not on record." };

  const done = await resolveIncident(parsed.data, me.id);
  if (!done) return { ok: false, error: "That error was already resolved, or is no longer on record." };
  await audit(me, "incident", parsed.data, "resolve");

  revalidatePath("/admin/status");
  // The count on the "System status" entry in every admin page's navigation.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
