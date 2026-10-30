import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

/**
 * Serverless functions each open their own connection and are frequently torn
 * down, so a large pool here would exhaust Postgres' connection slots. Point
 * DATABASE_URL at Supabase's pooler and keep the local pool small.
 *
 * The SESSION pooler (port 5432), not the transaction pooler (6543). Through
 * the transaction pooler, a connection handed a second query before the first
 * had answered — what every admin page does, ten queries at once over four
 * connections — lost one reply, every time, for any query: the page waited
 * for ever and Vercel killed it at 60 seconds. Measured 2026-10-30 against
 * the live pooler: 40 simultaneous queries on 5432, none lost; on 6543, one
 * lost per connection after its second query, whatever the library's
 * pipelining or type-fetching settings. Session mode holds one backend per
 * connection, so the pool stays small and idle connections close fast.
 *
 * `prepare: false` stays: it costs little, and it keeps the client correct
 * should the URL ever point at the transaction pooler again.
 */
/*
 * Session mode pins one database slot per open connection, and the free
 * pooler allows fifteen. Vercel pauses an idle server instance with its
 * connections still open, so paused instances pinned slots until the pooler
 * refused new clients ("max clients reached in session mode", 2026-10-30).
 * Two connections per instance, and — below — the instance is kept awake
 * just long enough after its last query for the idle timer to close them.
 */
const IDLE_SECONDS = 10;
let released: ((...args: unknown[]) => void) | null = null;

const client = postgres(url, {
  max: 2,
  prepare: false,
  // Every query is reported as a "release" to Vercel's pool helper (next block); the driver has no such event of its own.
  debug: () => released?.(),
  /*
   * A connection that has gone dead on the way to the pooler hangs a query for
   * ever: nothing answers, no error, no statement ever reaches Postgres, so no
   * timeout fires. Seen as admin pages hanging the full 60 seconds while the
   * database answered in 130 ms. So: TCP keep-alives every 20 seconds, idle
   * connections dropped after 10, and none kept longer than 5 minutes.
   */
  idle_timeout: IDLE_SECONDS,
  max_lifetime: 5 * 60,
  keep_alive: 20,
  /*
   * Fail fast when the database cannot be reached.
   *
   * Without a limit here a connection attempt to an unreachable backend hangs
   * until the serverless function itself is killed. Every request in flight
   * holds its slot for that whole time, new requests pile up behind them, and
   * a backend that is briefly unwell produces an outage far longer than the
   * problem that started it — which is how a short blip became fifteen minutes
   * of a completely dead site.
   *
   * Ten seconds is longer than a healthy connection ever takes and short
   * enough that the error boundary gets to render something useful.
   */
  connect_timeout: 10,
});

/*
 * On Vercel, keep the instance alive for a moment after its last query, so
 * idle connections are closed by the driver rather than left open through a
 * pause. The helper knows `pg` pools; this adapter speaks its two words —
 * an idle period, and a "release" event — on the driver's behalf. It does
 * nothing outside Vercel (no VERCEL_URL), so local runs and CI are untouched.
 */
if (process.env.VERCEL_URL) {
  attachDatabasePool({
    idleTimeout: (IDLE_SECONDS + 1) * 1000,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (event === "release") released = listener;
    },
  } as unknown as Parameters<typeof attachDatabasePool>[0]);
}

export const db = drizzle(client, { schema });
export { schema };
