#!/usr/bin/env node
/**
 * Runs a real PostgreSQL 17 server for local development — the same engine
 * and major version as Supabase in production — with nothing installed on the
 * machine: the binaries live in node_modules (embedded-postgres).
 *
 *   npm run db:local          # leave running in its own terminal
 *
 * Data persists in .postgres/ (gitignored) between runs. Listens on 54329 so
 * it never collides with a Postgres someone has installed on the default port.
 *
 * Why not PGlite: PGlite is a single database session. Served over a socket to
 * several clients (the dev server, the build's workers, a script), it queues
 * individual protocol messages, so two clients' queries interleave — the build
 * failed with "bind message supplies 6 parameters, but prepared statement
 * requires 0" — and it crashed outright when a client disconnected. PGlite is
 * still used for the in-memory schema test, where there is only ever one client.
 */

import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.postgres";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error(String(message).trim()),
});

if (!existsSync(`${dir}/PG_VERSION`)) {
  console.log("First run: creating the local database cluster…");
  await pg.initialise();
}
await pg.start();
console.log("PostgreSQL 17 listening on 127.0.0.1:54329 (database: postgres). Ctrl-C to stop.");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping PostgreSQL…");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
