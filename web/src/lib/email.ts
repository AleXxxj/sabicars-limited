import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, type OutboxEmail } from "@/db/schema";

/**
 * Transactional email through Resend, written down first.
 *
 * Every email goes into the outbox (email_outbox) and is then sent at once.
 * If Resend is busy (its default is ten requests a second per account) or
 * briefly down, the email waits in the outbox and the minute-by-minute job
 * (/api/cron/outbox) sends it in batches of 100 with a growing wait between
 * attempts. So a burst — thousands of partner welcomes after a viral post —
 * is delayed by minutes, never lost. An email still unsent after a day is
 * marked expired rather than delivered late.
 *
 * Nothing is sent twice. Every request to Resend carries an idempotency key
 * that Resend remembers for 24 hours (the same as the outbox's expiry): the
 * outbox row's id for a single email, and a key kept on the rows of a batch
 * for a batch. When a reply never arrives — a timeout, a dropped connection,
 * a server that died mid-send — the same email, or exactly the same batch,
 * is retried under the same key, and Resend answers "already sent" instead
 * of sending again.
 *
 * Without keys nothing is written and "not_configured" is returned, so a
 * site without email set up does not pile up mail it can never send.
 *
 * The newsletter does not use the outbox: it sends with sendBatch and keeps
 * its own record (newsletter_sends).
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** e.g. List-Unsubscribe, which every newsletter must carry. */
  headers?: Record<string, string>;
}

const from = () => `${process.env.RESEND_FROM_NAME ?? "Sabicars"} <${process.env.RESEND_FROM_EMAIL}>`;

/**
 * Resend's address. RESEND_API_URL exists for one reason: scripts/verify-outbox.mts
 * stands in a fake provider that is busy, then accepts, to prove nothing is
 * lost or sent twice. Never set it in Vercel.
 */
const resendApi = () => (process.env.RESEND_API_URL ?? "https://api.resend.com").replace(/\/+$/, "");

/** How long a failed email waits before the next try: 1, 2, 4 … minutes, at most an hour. */
function backoffMs(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

/** An email older than this is not sent at all: a welcome or a reminder a day late does more harm than good. Also how long Resend remembers an idempotency key. */
const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;
/** A sender that claimed an email and then died releases it after this long. */
const STALE_CLAIM_MS = 5 * 60 * 1000;
/** Resend's batch limit. */
const BATCH = 100;
/** The database refuses more (email_outbox_attempts_range); an email that has failed this often is given up. */
const MAX_ATTEMPTS = 50;
/** Between requests to Resend: comfortably under its ten a second. */
const PACE_MS = 150;

/**
 * The outcome of one request. `uncertain` marks a failure after which the
 * email may in fact have been sent (no answer, or a server error): it must be
 * retried under the same idempotency key, never as part of a new batch.
 */
type Delivery = { ok: true; id: string } | { ok: false; error: string; retryable: boolean; uncertain?: boolean };

/**
 * Busy, down, not yet authorised (a key being fixed), or the same key still
 * in flight (409 concurrent_idempotent_requests): worth another try. A
 * malformed address or message is not.
 */
function retryableStatus(status: number): boolean {
  return status === 429 || status === 409 || status >= 500 || status === 401 || status === 403;
}

function payload(m: Pick<OutboxEmail, "toAddress" | "subject" | "html" | "textBody" | "replyTo" | "headers">) {
  return {
    from: from(),
    to: [m.toAddress],
    subject: m.subject,
    html: m.html,
    text: m.textBody,
    reply_to: m.replyTo ?? undefined,
    headers: m.headers ?? undefined,
  };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function deliverOne(m: OutboxEmail): Promise<Delivery> {
  try {
    const res = await fetch(`${resendApi()}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `outbox-${m.id}`,
      },
      body: JSON.stringify(payload(m)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
      return {
        ok: false,
        error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`,
        retryable: retryableStatus(res.status),
        uncertain: res.status >= 500,
      };
    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id ?? "" };
  } catch (e) {
    // No answer is not the same as a refusal: it may have been sent. The retry carries the same key.
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      retryable: true,
      uncertain: true,
    };
  }
}

/** The batch key that means "retry this one alone, under its own key": its last single send has no known outcome. */
const aloneKey = (id: string) => `single:${id}`;

/**
 * Records the outcome of one attempt on one claimed email. `how` is how it was
 * sent: as part of a batch (a retryable failure keeps the batch key, so the
 * retry is the same request) or alone (an uncertain failure is marked to be
 * retried alone under its own key; a certain one may join any batch).
 */
async function settle(m: OutboxEmail, d: Delivery, how: "batch" | "alone"): Promise<void> {
  const now = new Date();
  if (d.ok) {
    await db
      .update(emailOutbox)
      .set({
        status: "sent",
        sentAt: now,
        providerId: d.id || null,
        lastError: null,
        claimedAt: null,
      })
      .where(eq(emailOutbox.id, m.id));
  } else if (d.retryable && m.attempts < MAX_ATTEMPTS) {
    await db
      .update(emailOutbox)
      .set({
        status: "pending",
        nextAttemptAt: new Date(now.getTime() + backoffMs(m.attempts)),
        lastError: d.error.slice(0, 500),
        claimedAt: null,
        ...(how === "alone" ? { batchKey: d.uncertain ? aloneKey(m.id) : null } : {}),
      })
      .where(eq(emailOutbox.id, m.id));
  } else {
    await db
      .update(emailOutbox)
      .set({
        status: "failed",
        lastError: (d.ok ? "" : d.error).slice(0, 500) || "Too many attempts.",
        claimedAt: null,
      })
      .where(eq(emailOutbox.id, m.id));
  }
}

/**
 * Sends one email: written to the outbox, then tried at once. `ok` means it
 * was sent or is safely queued for another try; it is false only when email
 * is not set up, or the provider refused this message for good.
 * A `dedupeKey` makes repeats harmless: the same key is only ever sent once.
 */
export async function sendEmail(message: EmailMessage, opts: { dedupeKey?: string } = {}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "not_configured" };
  let rowId: string;
  try {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        toAddress: message.to,
        subject: message.subject,
        html: message.html,
        textBody: message.text,
        replyTo: message.replyTo ?? null,
        headers: message.headers ?? null,
        dedupeKey: opts.dedupeKey ?? null,
      })
      .onConflictDoNothing({
        target: emailOutbox.dedupeKey,
        where: sql`${emailOutbox.dedupeKey} IS NOT NULL`,
      })
      .returning({ id: emailOutbox.id });
    if (!row) return { ok: true, id: "duplicate" };
    rowId = row.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // From here the email is on record: whatever happens next, the minute job will finish the job.
  try {
    // Claim it before sending, so the minute job cannot send the same email at the same moment.
    const [claimed] = await db
      .update(emailOutbox)
      .set({
        status: "sending",
        claimedAt: new Date(),
        attempts: sql`${emailOutbox.attempts} + 1`,
      })
      .where(and(eq(emailOutbox.id, rowId), eq(emailOutbox.status, "pending")))
      .returning();
    if (!claimed) return { ok: true, id: rowId };
    const d = await deliverOne(claimed);
    try {
      await settle(claimed, d, "alone");
    } catch (e) {
      // Sent but not marked: the stale-claim release retries it under the same key, which Resend ignores.
      console.error("[email] sent, but could not record it", e instanceof Error ? e.message : e);
    }
    if (!d.ok && !d.retryable) return { ok: false, error: d.error };
    return { ok: true, id: d.ok ? d.id || rowId : rowId };
  } catch (e) {
    console.error("[email] queued; the minute job will send it", e instanceof Error ? e.message : e);
    return { ok: true, id: rowId };
  }
}

/** Turns a row from a raw `returning *` into the typed shape. */
function fromRaw(r: Record<string, unknown>): OutboxEmail {
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    id: r.id as string,
    toAddress: r.to_address as string,
    subject: r.subject as string,
    html: r.html as string,
    textBody: r.text_body as string,
    replyTo: (r.reply_to as string | null) ?? null,
    headers: (r.headers as Record<string, string> | null) ?? null,
    dedupeKey: (r.dedupe_key as string | null) ?? null,
    status: r.status as string,
    attempts: Number(r.attempts),
    nextAttemptAt: date(r.next_attempt_at) ?? new Date(),
    claimedAt: date(r.claimed_at),
    batchKey: (r.batch_key as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    providerId: (r.provider_id as string | null) ?? null,
    createdAt: date(r.created_at) ?? new Date(),
    sentAt: date(r.sent_at),
  };
}

/**
 * The next batch to send: first a batch whose earlier attempt has no known
 * outcome (same rows, same key), otherwise up to 100 due emails, given a new
 * key. SKIP LOCKED lets two runs share the work without overlap.
 */
async function claimBatch(): Promise<{
  key: string;
  rows: OutboxEmail[];
} | null> {
  const [retry] = (await db.execute(sql`
    select batch_key from ${emailOutbox}
    where status = 'pending' and batch_key is not null and next_attempt_at <= now() and attempts < ${MAX_ATTEMPTS}
    order by created_at limit 1
  `)) as unknown as { batch_key: string }[];
  if (retry) {
    const rows = (await db.execute(sql`
      update ${emailOutbox} set status = 'sending', claimed_at = now(), attempts = attempts + 1
      where id in (
        select id from ${emailOutbox}
        where status = 'pending' and batch_key = ${retry.batch_key}
        for update skip locked
      )
      returning *
    `)) as unknown as Record<string, unknown>[];
    if (rows.length) return { key: retry.batch_key, rows: rows.map(fromRaw) };
  }
  const key = randomUUID();
  const rows = (await db.execute(sql`
    update ${emailOutbox} set status = 'sending', claimed_at = now(), attempts = attempts + 1, batch_key = ${key}
    where id in (
      select id from ${emailOutbox}
      where status = 'pending' and batch_key is null and next_attempt_at <= now() and attempts < ${MAX_ATTEMPTS}
      order by created_at
      limit ${BATCH}
      for update skip locked
    )
    returning *
  `)) as unknown as Record<string, unknown>[];
  return rows.length ? { key, rows: rows.map(fromRaw) } : null;
}

/** Puts claimed emails back untouched, as if this run had never taken them. */
async function release(rows: OutboxEmail[], forgetBatch: boolean): Promise<void> {
  if (!rows.length) return;
  await db
    .update(emailOutbox)
    .set({
      status: "pending",
      claimedAt: null,
      attempts: sql`greatest(0, ${emailOutbox.attempts} - 1)`,
      ...(forgetBatch ? { batchKey: null } : {}),
    })
    .where(
      inArray(
        emailOutbox.id,
        rows.map((r) => r.id),
      ),
    );
}

/**
 * The minute job. Gives up emails that cannot be sent (too old, too many
 * attempts), releases claims a dead sender left behind, then sends what is
 * due in batches of 100 until nothing is due, `maxEmails` have been tried, or
 * `budgetMs` has passed — whichever comes first, so a run always finishes
 * well inside the job's time limit and anything it did not reach is simply
 * left for the next minute.
 */
export async function drainOutbox(maxEmails = 1000, budgetMs = 40_000): Promise<{ sent: number; retried: number; failed: number; expired: number }> {
  const result = { sent: 0, retried: 0, failed: 0, expired: 0 };
  if (!emailConfigured()) return result;
  const started = Date.now();
  const over = () => Date.now() - started > budgetMs;
  const dayAgo = new Date(started - EXPIRE_AFTER_MS);

  // A batch expires as a whole when its oldest email does, so a retried batch is always the same set.
  const expired = await db
    .update(emailOutbox)
    .set({
      status: "expired",
      lastError: "Not sent within a day.",
      claimedAt: null,
    })
    .where(
      and(
        inArray(emailOutbox.status, ["pending", "sending"]),
        sql`(${emailOutbox.createdAt} < ${dayAgo.toISOString()} or ${emailOutbox.batchKey} in (select batch_key from ${emailOutbox} where batch_key is not null and created_at < ${dayAgo.toISOString()}))`,
      ),
    )
    .returning({ id: emailOutbox.id });
  result.expired = expired.length;
  const exhausted = await db
    .update(emailOutbox)
    .set({ status: "failed", lastError: "Too many attempts.", claimedAt: null })
    .where(and(eq(emailOutbox.status, "pending"), gte(emailOutbox.attempts, MAX_ATTEMPTS)))
    .returning({ id: emailOutbox.id });
  result.failed += exhausted.length;
  // A sender that died mid-send: back in the queue a minute from now, its batch key kept.
  await db
    .update(emailOutbox)
    .set({
      status: "pending",
      claimedAt: null,
      nextAttemptAt: new Date(started + 60_000),
    })
    .where(and(eq(emailOutbox.status, "sending"), lt(emailOutbox.claimedAt, new Date(started - STALE_CLAIM_MS))));

  let tried = 0;
  while (tried < maxEmails && !over()) {
    const batch = await claimBatch();
    if (!batch) break;
    const { key, rows } = batch;
    tried += rows.length;

    let res: Response | null = null;
    let networkError: string | null = null;
    if (!key.startsWith("single:"))
      try {
        res = await fetch(`${resendApi()}/emails/batch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `outbox-batch-${key}`,
          },
          body: JSON.stringify(rows.map(payload)),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (e) {
        networkError = e instanceof Error ? e.message : String(e);
      }

    if (key.startsWith("single:")) {
      // One email whose last single send has no known outcome: retried alone, under its own key.
      for (const m of rows) {
        const d = await deliverOne(m);
        await settle(m, d, "alone");
        if (d.ok) result.sent++;
        else if (d.retryable) result.retried++;
        else result.failed++;
      }
    } else if (res?.ok) {
      const body = (await res.json().catch(() => null)) as {
        data?: { id?: string }[];
      } | null;
      await Promise.all(rows.map((m, i) => settle(m, { ok: true, id: body?.data?.[i]?.id ?? "" }, "batch")));
      result.sent += rows.length;
    } else if (res && !retryableStatus(res.status)) {
      // Refused as a whole (usually one bad address), so nothing was sent: send each alone under its own
      // key, so only the bad one fails. What the time budget does not reach goes back, never sent.
      for (let i = 0; i < rows.length; i++) {
        if (over()) {
          await release(rows.slice(i), true);
          break;
        }
        const d = await deliverOne(rows[i]);
        await settle(rows[i], d, "alone");
        if (d.ok) result.sent++;
        else if (d.retryable) result.retried++;
        else result.failed++;
        await pause(PACE_MS);
      }
    } else {
      // Busy, down, or no answer at all — it may have been sent. Retried later as the same batch, same key.
      const error = networkError ?? `Resend ${res?.status}: ${(await res?.text().catch(() => ""))?.slice(0, 200)}`;
      await Promise.all(rows.map((m) => settle(m, { ok: false, error, retryable: true, uncertain: true }, "batch")));
      result.retried += rows.length;
      break; // The next minute's run tries again.
    }
    await pause(PACE_MS);
  }
  return result;
}

/** Sent, expired and failed email is kept for 30 days, then removed. */
export async function pruneOutbox(): Promise<number> {
  const rows = await db
    .delete(emailOutbox)
    .where(and(inArray(emailOutbox.status, ["sent", "expired", "failed"]), lte(emailOutbox.createdAt, new Date(Date.now() - 30 * 86_400_000))))
    .returning({ id: emailOutbox.id });
  return rows.length;
}

/** Emails still waiting, for tests: the queue is empty when this is zero. */
export async function pendingEmails(): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(and(inArray(emailOutbox.status, ["pending", "sending"]), isNull(emailOutbox.sentAt)));
  return r?.n ?? 0;
}

/**
 * Up to 100 emails in one request — Resend's batch limit — each with its own
 * recipient, so no subscriber ever sees another's address. Used by the
 * newsletter, which keeps its own record and does not go through the outbox.
 * A busy answer (429) is retried twice with a growing wait before the chunk
 * is reported as failed.
 */
export async function sendBatch(messages: EmailMessage[], idempotencyKey?: string): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "not_configured" };
  if (messages.length > 100) throw new Error("A batch is at most 100 emails.");
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${resendApi()}/emails/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(
          messages.map((m) => ({
            from: from(),
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            reply_to: m.replyTo,
            headers: m.headers,
          })),
        ),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return { ok: true, sent: messages.length };
      lastError = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status !== 429 && !(idempotencyKey && res.status >= 500)) break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // Without a key a retry after no answer could send twice, so only keyed batches retry here.
      if (!idempotencyKey) break;
    }
    await pause(1_000 * 2 ** attempt);
  }
  return { ok: false, error: lastError };
}

/** Escapes text for an HTML email body. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
