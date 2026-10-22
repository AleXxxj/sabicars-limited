import "server-only";
import { createHash } from "node:crypto";
import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { incidents, type Incident } from "@/db/schema";
import { alertManagers } from "@/lib/alerts";
import { sabicarsDealerId } from "@/lib/leads";

/**
 * Errors the site saw, on record and told to the people who can act.
 *
 * Every server error (src/instrumentation.ts), every error a browser's
 * boundary catches (/api/ops/client-error) and every failed deploy check
 * (/api/ops/alert) lands here as an incident. The same error again counts
 * up on the same row instead of adding a new one, so the status page shows
 * "this failed 40 times since Tuesday", not forty lines. Managers are
 * pushed and emailed the first time an error is seen, and again at most
 * every few hours while it keeps happening.
 *
 * Nothing personal is stored: account numbers, phone numbers and emails are
 * masked before a message or a stack is written.
 */

export type IncidentKind = "server" | "client" | "check";

const MESSAGE_CHARS = 500;
const STACK_CHARS = 4000;
/** How long after telling the managers the same error has to keep happening before they are told again. */
const REALERT_HOURS = 6;

/** Errors that are part of how Next.js works, or a browser going away, not faults. */
const BENIGN = [/NEXT_REDIRECT/, /NEXT_NOT_FOUND/, /NEXT_HTTP_ERROR_FALLBACK/, /destination stream closed early/i, /^Connection closed\.?$/i, /aborted/i, /ECONNRESET/];

/** Masks what must never sit in an error log: ten-digit account numbers, phone numbers, emails, long tokens. */
export function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, (m) => `${m.slice(0, 2)}••••${m.slice(-2)}`)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/(sk|pk|rk)_(live|test)_[A-Za-z0-9]+/g, "[key]");
}

function fingerprintOf(kind: IncidentKind, message: string, stack: string | null, path: string | null): string {
  const frame = (stack ?? "").split("\n").find((l) => /^\s+at /.test(l))?.trim() ?? "";
  // Numbers in a message (ids, counts, amounts) would split one error into many rows.
  const shape = message.replace(/\d+/g, "#");
  return createHash("sha256").update(`${kind}\n${shape}\n${frame}\n${frame ? "" : (path ?? "")}`).digest("hex");
}

export function isBenign(message: string, digest?: string | null): boolean {
  const text = `${message} ${digest ?? ""}`;
  return BENIGN.some((re) => re.test(text));
}

export interface IncidentInput {
  kind: IncidentKind;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  digest?: string | null;
}

/**
 * Records an error and tells the managers when it is new or has kept
 * happening. Never throws: an error while recording an error is logged and
 * swallowed, because the request that failed must not fail twice.
 */
export async function recordIncident(input: IncidentInput): Promise<{ id: string; count: number; alerted: boolean } | null> {
  try {
    const message = redact(input.message || "Unknown error").slice(0, MESSAGE_CHARS);
    if (isBenign(message, input.digest)) return null;
    const stack = input.stack ? redact(input.stack).slice(0, STACK_CHARS) : null;
    const path = input.path ? redact(input.path).slice(0, 300) : null;
    const fingerprint = fingerprintOf(input.kind, message, stack, path);
    const now = new Date();
    const [row] = await db
      .insert(incidents)
      .values({ fingerprint, kind: input.kind, message, stack, path, method: input.method ?? null, digest: input.digest ?? null, firstSeenAt: now, lastSeenAt: now })
      .onConflictDoUpdate({
        target: incidents.fingerprint,
        set: { count: sql`${incidents.count} + 1`, lastSeenAt: now, message, stack, path, method: input.method ?? null, digest: input.digest ?? null, resolvedAt: null, resolvedBy: null },
      })
      .returning({ id: incidents.id, count: incidents.count, lastAlertedAt: incidents.lastAlertedAt });
    if (!row) return null;

    // Claim the alert in the same row, so two instances seeing the same error do not both page the owner.
    const due = new Date(now.getTime() - REALERT_HOURS * 60 * 60 * 1000);
    const [claimed] = await db
      .update(incidents)
      .set({ lastAlertedAt: now })
      .where(and(eq(incidents.id, row.id), or(isNull(incidents.lastAlertedAt), lt(incidents.lastAlertedAt, due))))
      .returning({ id: incidents.id });
    if (!claimed) return { id: row.id, count: row.count, alerted: false };

    try {
      const dealerId = await sabicarsDealerId();
      const where = path ? ` on ${path}` : "";
      await alertManagers(dealerId, {
        title: row.count === 1 ? `Site error${where}` : `Still failing: ${row.count} times${where}`,
        body: `${label(input.kind)}: ${message.slice(0, 160)}`,
        url: "/admin/status#errors",
        tag: `incident-${fingerprint.slice(0, 12)}`,
        action: "Open system status",
      });
    } catch (e) {
      console.error("[incidents] could not alert managers", e instanceof Error ? e.message : e);
    }
    return { id: row.id, count: row.count, alerted: true };
  } catch (e) {
    console.error("[incidents] could not record", e instanceof Error ? e.message : e);
    return null;
  }
}

function label(kind: IncidentKind): string {
  return kind === "server" ? "Server error" : kind === "client" ? "Error in a visitor's browser" : "Deploy check";
}

/** Open incidents, most recent first, for the status page. */
export async function openIncidents(limit = 30): Promise<Incident[]> {
  return db.select().from(incidents).where(isNull(incidents.resolvedAt)).orderBy(desc(incidents.lastSeenAt)).limit(limit);
}

/** Incidents resolved in the last while, so a manager can see what was dealt with. */
export async function recentlyResolved(limit = 10): Promise<Incident[]> {
  return db.select().from(incidents).where(sql`${incidents.resolvedAt} IS NOT NULL`).orderBy(desc(incidents.resolvedAt)).limit(limit);
}

export async function openIncidentCount(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(incidents).where(isNull(incidents.resolvedAt));
  return r?.n ?? 0;
}

/** Marks an incident dealt with. If it happens again it reopens on the same row. */
export async function resolveIncident(id: string, staffId: string): Promise<boolean> {
  const [row] = await db
    .update(incidents)
    .set({ resolvedAt: new Date(), resolvedBy: staffId })
    .where(and(eq(incidents.id, id), isNull(incidents.resolvedAt)))
    .returning({ id: incidents.id });
  return Boolean(row);
}
