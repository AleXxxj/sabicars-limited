#!/usr/bin/env node
/**
 * Proves the email outbox (lib/email.ts) loses nothing and sends nothing
 * twice, against a stand-in for Resend that behaves the way Resend does on a
 * bad day: busy at first, then accepting; refusing a whole batch for one bad
 * address; accepting a request and then losing the reply. Like Resend, it
 * remembers each Idempotency-Key and answers a repeat with the first answer
 * instead of sending again — so "received exactly once" here means the
 * outbox retried an uncertain send under the same key.
 *
 * Every email the founder's audience can trigger (a partner's welcome, a
 * viewing reminder, a commission notice) goes through sendEmail. On a viral
 * day thousands arrive in minutes, and Resend accepts about two requests a
 * second by default. What matters is that each person gets their email once — late if
 * need be, but never lost and never doubled — and that a broken address does
 * not hold up anyone else's.
 *
 * It writes and deletes rows in DATABASE_URL (every address ends in
 * @outbox.test), and refuses a Supabase address. It also refuses to run while
 * other emails wait in the outbox, because the drain it calls would hand them
 * to the stand-in. Runs in CI on the throwaway database
 * (.github/workflows/e2e.yml) and locally with `npm run test:outbox`.
 */

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to a local or throwaway database.");
  process.exit(1);
}
if (/supabase/i.test(url)) {
  console.error("Refusing: this check writes and deletes outbox rows and drains the outbox. Point DATABASE_URL at a local or throwaway database.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function expect(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${label}\x1b[0m`);
    if (detail) console.log(`      ${detail}`);
  }
}

// ── The stand-in for Resend ────────────────────────────────────────────────
// POST /emails is busy (429) for its first three calls, then accepts; it
// refuses (422) any address containing "invalid". POST /emails/batch is busy
// once, then accepts the whole batch in order, unless any address in it
// contains "invalid", when it refuses the whole batch, as Resend does.
// Either endpoint, given an address containing "lost-reply" for the first
// time, accepts the request and then drops the connection without answering:
// the email went, but the sender cannot know it. Both honour Idempotency-Key.

interface Sent {
  from?: string;
  to?: string[];
}
const accepted = new Map<string, number>(); // address → times accepted
const idTo = new Map<string, string>(); // provider id → address
let singleCalls = 0;
let batchCalls = 0;
let badAuth = 0;
let wrongFrom = 0;
/** Idempotency-Key → the request body first sent with it and the answer given, as Resend keeps for 24 hours. */
const keys = new Map<string, { request: string; status: number; body: unknown }>();
/** Keys reused with a different body: Resend refuses these (409), and so does the stand-in. */
let keyMismatches = 0;
let keyedRepeats = 0;
const droppedOnce = new Set<string>();

function accept(m: Sent): string {
  const to = (m.to ?? []).join(",");
  if (!m.from?.includes("test@sabicars.test")) wrongFrom++;
  accepted.set(to, (accepted.get(to) ?? 0) + 1);
  const id = `fake_${idTo.size + 1}`;
  idTo.set(id, to);
  return id;
}

const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const busy = { statusCode: 429, name: "rate_limit_exceeded", message: "Too many requests. You can only make 10 requests per second." };
const invalid = { statusCode: 422, name: "validation_error", message: "Invalid `to` field." };

async function handle(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (req.headers.authorization !== "Bearer test") {
    badAuth++;
    return reply(res, 401, { statusCode: 401, name: "missing_api_key", message: "Missing API key." });
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const body: unknown = JSON.parse(raw || "null");
  const key = typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : null;
  if (key && keys.has(key)) {
    const first = keys.get(key)!;
    // Like Resend: the same key with a different body is refused, never answered from memory.
    if (first.request !== raw) {
      keyMismatches++;
      return reply(res, 409, { statusCode: 409, name: "invalid_idempotent_request", message: "Same idempotency key used with a different request payload." });
    }
    keyedRepeats++;
    return reply(res, first.status, first.body);
  }
  /** Accepted: remembered under its key, then answered — or, the first time for a "lost-reply" address, never answered. */
  const done = (status: number, answer: unknown, addresses: string[]) => {
    if (key && status === 200) keys.set(key, { request: raw, status, body: answer });
    const lost = addresses.find((a) => a.includes("lost-reply") && !droppedOnce.has(a));
    if (status === 200 && lost) {
      droppedOnce.add(lost);
      return res.destroy();
    }
    reply(res, status, answer);
  };
  if (req.method === "POST" && req.url === "/emails") {
    singleCalls++;
    const m = body as Sent;
    if (singleCalls <= 3 && !(m.to ?? []).some((a) => a.includes("lost-reply"))) return reply(res, 429, busy);
    if ((m.to ?? []).some((a) => a.includes("invalid"))) return reply(res, 422, invalid);
    return done(200, { id: accept(m) }, m.to ?? []);
  }
  if (req.method === "POST" && req.url === "/emails/batch") {
    batchCalls++;
    if (batchCalls === 1) return reply(res, 429, busy);
    const batch = body as Sent[];
    if (batch.some((m) => (m.to ?? []).some((a) => a.includes("invalid")))) return reply(res, 422, invalid);
    return done(200, { data: batch.map((m) => ({ id: accept(m) })) }, batch.flatMap((m) => m.to ?? []));
  }
  reply(res, 404, { statusCode: 404, name: "not_found", message: "Not found." });
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => reply(res, 500, { message: String(e) }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;

// Set before lib/email is imported, so nothing in it can ever see a real key or Resend's real address.
process.env.RESEND_API_URL = `http://127.0.0.1:${port}`;
process.env.RESEND_API_KEY = "test";
process.env.RESEND_FROM_EMAIL = "test@sabicars.test";
const { sendEmail, drainOutbox, pruneOutbox } = await import("../src/lib/email");
const { outboxCheck } = await import("../src/lib/launch-checks");

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const TEST = "%@outbox.test";
const message = (to: string, n: number | string) => ({ to, subject: `Outbox check ${n}`, html: `<p>Outbox check ${n}</p>`, text: `Outbox check ${n}` });

/** Puts every waiting test email due now, instead of sleeping through its back-off. */
const makeDue = () => sql`update email_outbox set next_attempt_at = now() where to_address like ${TEST} and status = 'pending'`;

try {
  // Leftovers of a run that was killed half-way.
  await sql`delete from email_outbox where to_address like ${TEST}`;
  const [{ n: foreign }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where status in ('pending', 'sending')`;
  if (foreign > 0) {
    throw new Error(
      `Refusing: ${foreign} email(s) that are not this check's are waiting in the outbox, and draining it would hand them to the stand-in. Run this on a database with nothing waiting.`,
    );
  }
  // The status page's check, before this run adds anything; only judged on an outbox holding nothing else.
  const [{ n: others }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox`;
  const before = await outboxCheck();

  // ── 7. Without keys: nothing written, nothing sent ───────────────────────
  // lib/email reads the keys on every call, so taking them away for one call is the same as a fresh import without them.
  console.log("\nWithout Resend keys");
  {
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const r = await sendEmail(message("unset@outbox.test", "unset"));
    const drained = await drainOutbox(10);
    process.env.RESEND_API_KEY = saved.key;
    process.env.RESEND_FROM_EMAIL = saved.from;
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where to_address = 'unset@outbox.test'`;
    expect("sendEmail answers not_configured", !r.ok && r.error === "not_configured", JSON.stringify(r));
    expect("and writes no row, so a site without email piles up nothing", n === 0, `${n} rows`);
    expect("the minute job does nothing either", drained.sent + drained.retried + drained.failed + drained.expired === 0 && singleCalls + batchCalls === 0, JSON.stringify(drained));
  }

  // ── 1. A burst of 250 ────────────────────────────────────────────────────
  console.log("\nA burst of 250 at once, while Resend is busy at first");
  const buyers = Array.from({ length: 250 }, (_, i) => `buyer-${i + 1}@outbox.test`);
  const started = Date.now();
  const results = await Promise.all(buyers.map((to, i) => sendEmail(message(to, i + 1))));
  const notOk = results.filter((r) => !r.ok);
  expect(`all 250 calls answer ok (${Date.now() - started} ms)`, notOk.length === 0, `${notOk.length} not ok: ${JSON.stringify(notOk[0])}`);
  const [queued] = await sql<{ sent: number; pending: number; rows: number }[]>`
    select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'pending')::int as pending, count(*)::int as rows
    from email_outbox where to_address like 'buyer-%@outbox.test'`;
  expect("each is written down exactly once", queued.rows === 250, `${queued.rows} rows`);
  expect(
    `the three that met a busy Resend wait in the outbox instead of being lost (${queued.sent} sent at once, ${queued.pending} waiting)`,
    queued.sent === 247 && queued.pending === 3,
    JSON.stringify(queued),
  );

  // ── 2. The same key twice is one email ───────────────────────────────────
  console.log("\nDedupe keys");
  const key = `outbox-check:${randomUUID()}`;
  const first = await sendEmail(message("dedupe@outbox.test", "dedupe"), { dedupeKey: key });
  const second = await sendEmail(message("dedupe@outbox.test", "dedupe again"), { dedupeKey: key });
  const [{ n: keyed }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where dedupe_key = ${key}`;
  expect("a key sent twice answers ok both times, the second as a duplicate", first.ok && second.ok && second.id === "duplicate", JSON.stringify([first, second]));
  expect("and is stored once", keyed === 1, `${keyed} rows`);
  const burstKey = `outbox-check:${randomUUID()}`;
  const burst = await Promise.all(Array.from({ length: 5 }, (_, i) => sendEmail(message("dedupe-burst@outbox.test", `burst ${i}`), { dedupeKey: burstKey })));
  const [{ n: burstRows }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where dedupe_key = ${burstKey}`;
  expect("five at the same moment with one key are stored once", burst.every((r) => r.ok) && burstRows === 1, `${burstRows} rows`);

  // ── 5 and 6: an email a day old, and one a dead sender left claimed ──────
  await sql`
    insert into email_outbox (to_address, subject, html, text_body, created_at, next_attempt_at)
    values ('old@outbox.test', 'Outbox check old', '<p>old</p>', 'old', now() - interval '25 hours', now() - interval '25 hours')`;
  await sql`
    insert into email_outbox (to_address, subject, html, text_body, status, attempts, claimed_at)
    values ('stuck@outbox.test', 'Outbox check stuck', '<p>stuck</p>', 'stuck', 'sending', 1, now() - interval '10 minutes')`;

  // ── The minute job ───────────────────────────────────────────────────────
  console.log("\nThe minute job (drainOutbox), run after run");
  const drain = async (label: string) => {
    await makeDue();
    const r = await drainOutbox(1000);
    console.log(`    ${label}: sent ${r.sent}, put back ${r.retried}, refused ${r.failed}, expired ${r.expired}`);
    return r;
  };
  const a = await drain("run 1, Resend busy");
  // The stuck one was released for a minute later (a dead sender's email waits before its retry), so this batch is the three that met a busy Resend.
  expect("a busy Resend stops the run early and puts the batch back; nothing is marked sent", a.sent === 0 && a.retried === 3, JSON.stringify(a));
  expect("the day-old email is expired, not sent", a.expired === 1, JSON.stringify(a));
  const b = await drain("run 2, Resend accepting");
  expect("the next run sends the batch, the released claim included", b.sent === 4, JSON.stringify(b));

  // ── 4. One bad address in a batch ────────────────────────────────────────
  const mates = Array.from({ length: 4 }, (_, i) => `mate-${i + 1}@outbox.test`);
  for (const to of ["invalid@outbox.test", ...mates]) {
    await sql`insert into email_outbox (to_address, subject, html, text_body) values (${to}, 'Outbox check batch', '<p>batch</p>', 'batch')`;
  }
  const c = await drain("run 3, one bad address in the batch");
  expect("a batch refused for one address is sent one by one: 4 sent, 1 refused", c.sent === 4 && c.failed === 1, JSON.stringify(c));
  for (let i = 4; i <= 8; i++) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where to_address like ${TEST} and status in ('pending', 'sending')`;
    if (!n) break;
    await drain(`run ${i}`);
  }

  // ── 8. A reply that never came ───────────────────────────────────────────
  // The stand-in takes these and then drops the connection, so the sender cannot know they went.
  console.log("\nAccepted, but the reply was lost");
  // (a) Sent alone by sendEmail: it must be retried alone, under its own key, never inside a new batch.
  const single = await sendEmail(message("lost-reply-single@outbox.test", "lost single"));
  expect("sendEmail answers ok: the email is on record and will be retried", single.ok, JSON.stringify(single));
  const [{ batch_key: singleKey }] = await sql<{ batch_key: string | null }[]>`select batch_key from email_outbox where to_address = 'lost-reply-single@outbox.test'`;
  expect("it is marked to be retried alone, under its own key", Boolean(singleKey?.startsWith("single:")), String(singleKey));
  // (b) Sent in a batch by the minute job: retried as exactly the same batch, under the same key.
  const lostMates = ["lost-reply-batch@outbox.test", "lost-mate-1@outbox.test", "lost-mate-2@outbox.test"];
  for (const to of lostMates) {
    await sql`insert into email_outbox (to_address, subject, html, text_body) values (${to}, 'Outbox check lost batch', '<p>lost batch</p>', 'lost batch')`;
  }
  const repeatsBefore = keyedRepeats;
  for (let i = 0; i < 4; i++) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from email_outbox where to_address like 'lost-%@outbox.test' and status in ('pending', 'sending')`;
    if (!n) break;
    await drain(`lost-reply run ${i + 1}`);
  }
  const lostAll = ["lost-reply-single@outbox.test", ...lostMates];
  const lostRows = await sql<{ to_address: string; status: string }[]>`select to_address, status from email_outbox where to_address = any(${lostAll}::text[])`;
  expect(
    "each is in the end marked sent",
    lostAll.every((to) => lostRows.find((r) => r.to_address === to)?.status === "sent"),
    JSON.stringify(lostRows),
  );
  expect(
    "and was received exactly once: the retry carried the same key, and Resend answered it from memory",
    lostAll.every((to) => (accepted.get(to) ?? 0) === 1),
    lostAll.map((to) => `${to} × ${accepted.get(to) ?? 0}`).join(", "),
  );
  expect("the retries were answered from the key, not sent again", keyedRepeats - repeatsBefore >= 2, `${keyedRepeats - repeatsBefore} keyed repeats`);
  expect("every retry was byte for byte the request first sent under its key (Resend refuses anything else)", keyMismatches === 0, `${keyMismatches} key(s) reused with a different body`);

  // ── What the outbox holds now, against what the stand-in received ────────
  console.log("\nAfter the runs");
  const rows = await sql<{ to_address: string; status: string; last_error: string | null; provider_id: string | null; sent_at: Date | null }[]>`
    select to_address, status, last_error, provider_id, sent_at from email_outbox where to_address like ${TEST}`;
  const row = (to: string) => rows.find((r) => r.to_address === to);
  const times = (to: string) => accepted.get(to) ?? 0;

  // 3. Every one of the 250 sent, and received exactly once.
  const buyerRows = rows.filter((r) => r.to_address.startsWith("buyer-"));
  const unsent = buyerRows.filter((r) => r.status !== "sent");
  const counts = buyers.map(times);
  const wrongCount = buyers.filter((to) => times(to) !== 1);
  expect(`all 250 are sent (${buyerRows.length - unsent.length} of ${buyerRows.length})`, buyerRows.length === 250 && unsent.length === 0, JSON.stringify(unsent.slice(0, 3)));
  expect(
    `Resend received each exactly once (fewest ${Math.min(...counts)}, most ${Math.max(...counts)})`,
    wrongCount.length === 0,
    wrongCount
      .slice(0, 5)
      .map((to) => `${to} × ${times(to)}`)
      .join(", "),
  );
  const misfiled = rows.filter((r) => r.status === "sent" && (!r.sent_at || !r.provider_id || idTo.get(r.provider_id) !== r.to_address));
  expect("every sent email carries the provider's id for its own address, and when it went", misfiled.length === 0, JSON.stringify(misfiled.slice(0, 3)));
  expect("the dedupe addresses received one email each", times("dedupe@outbox.test") === 1 && times("dedupe-burst@outbox.test") === 1, `${times("dedupe@outbox.test")}, ${times("dedupe-burst@outbox.test")}`);

  // 4. The bad address fails alone.
  const bad = row("invalid@outbox.test");
  expect("the invalid address ends failed, with Resend's 422 recorded", bad?.status === "failed" && Boolean(bad.last_error?.includes("422")) && times("invalid@outbox.test") === 0, JSON.stringify(bad));
  expect(
    "its batch-mates are sent, once each",
    mates.every((to) => row(to)?.status === "sent" && times(to) === 1),
    mates.map((to) => `${to} ${row(to)?.status} × ${times(to)}`).join(", "),
  );

  // 5. Too old to be worth sending.
  const old = row("old@outbox.test");
  expect("the day-old email ends expired and was never sent", old?.status === "expired" && !old.sent_at && times("old@outbox.test") === 0, JSON.stringify(old));

  // 6. A dead sender's claim is released.
  const stuck = row("stuck@outbox.test");
  expect("the email stuck in 'sending' for 10 minutes is released and sent, once", stuck?.status === "sent" && times("stuck@outbox.test") === 1, JSON.stringify(stuck));

  // The whole account.
  const left = rows.filter((r) => r.status === "pending" || r.status === "sending");
  expect("nothing is left waiting", left.length === 0, JSON.stringify(left.slice(0, 3)));
  const sentRows = rows.filter((r) => r.status === "sent").length;
  const receivedTotal = [...accepted.values()].reduce((s, n) => s + n, 0);
  expect(`Resend received exactly what the outbox says was sent (${receivedTotal} = ${sentRows})`, receivedTotal === sentRows, `${receivedTotal} received, ${sentRows} sent`);
  expect("every request carried the key and the sender address", badAuth === 0 && wrongFrom === 0, `${badAuth} without the key, ${wrongFrom} from another address`);

  // ── The "Email outbox" check on /admin/status (lib/launch-checks.ts) ─────
  console.log("\nThe status page's Email outbox check");
  if (others === 0) expect(`an empty outbox reads as healthy ("${before.detail}")`, before.status === "ok" && before.detail.startsWith("Nothing waiting"), JSON.stringify(before));
  else console.log(`    (healthy reading not judged: the outbox already held ${others} other rows)`);
  const after = await outboxCheck();
  expect(
    "after this run it warns, counting the refused and the expired email",
    after.status === "warn" && after.detail.includes("refused by Resend") && after.detail.includes("expired unsent"),
    JSON.stringify(after),
  );
  await sql`
    insert into email_outbox (to_address, subject, html, text_body, created_at, next_attempt_at)
    values ('late@outbox.test', 'Outbox check late', '<p>late</p>', 'late', now() - interval '20 minutes', now() + interval '1 hour')`;
  const late = await outboxCheck();
  expect(
    "an email waiting 20 minutes says the minute job may not be running",
    late.status === "warn" && late.detail.includes("the oldest for 20 minutes") && Boolean(late.fix?.includes("/api/cron/outbox")),
    JSON.stringify(late),
  );

  // ── Housekeeping: sent mail is kept 30 days ──────────────────────────────
  console.log("\nPruning");
  const [{ n: prunable }] = await sql<{ n: number }[]>`
    select count(*)::int as n from email_outbox
    where to_address not like ${TEST} and status in ('sent', 'expired', 'failed') and created_at <= now() - interval '30 days'`;
  if (prunable > 0) {
    console.log(`    (not judged: ${prunable} older rows that are not this check's would be pruned too)`);
  } else {
    await sql`
      insert into email_outbox (to_address, subject, html, text_body, status, sent_at, created_at)
      values ('pruned@outbox.test', 'Outbox check pruned', '<p>p</p>', 'p', 'sent', now() - interval '31 days', now() - interval '31 days'),
             ('kept@outbox.test', 'Outbox check kept', '<p>k</p>', 'k', 'sent', now() - interval '29 days', now() - interval '29 days')`;
    const pruned = await pruneOutbox();
    const kept = await sql<{ to_address: string }[]>`select to_address from email_outbox where to_address in ('pruned@outbox.test', 'kept@outbox.test')`;
    expect(
      "a sent email older than 30 days is removed; one 29 days old is kept",
      pruned === 1 && kept.length === 1 && kept[0].to_address === "kept@outbox.test",
      `${pruned} pruned, left: ${kept.map((k) => k.to_address).join(", ")}`,
    );
  }
} catch (e) {
  failed++;
  console.error(`\n  \x1b[31m✗ ${e instanceof Error ? e.message : String(e)}\x1b[0m`);
} finally {
  const removed = await sql`delete from email_outbox where to_address like ${TEST}`.catch(() => null);
  if (removed) console.log(`\n  Removed this check's ${removed.count} rows.`);
  await sql.end();
  server.close();
}

console.log(
  `\n${passed} passed, ${failed} failed.` + (failed ? "  \x1b[31mOUTBOX NOT VERIFIED\x1b[0m\n" : "  \x1b[32mThe outbox loses nothing and sends nothing twice.\x1b[0m\n"),
);
process.exit(failed ? 1 : 0);
