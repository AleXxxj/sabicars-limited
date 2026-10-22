#!/usr/bin/env node
/**
 * Loads a backup file (from /api/cron/backup or the status page's download)
 * into an EMPTY database whose schema is already in place.
 *
 *   npm run db:migrate                                 # the schema first
 *   npm run backup:restore -- sabicars-backup-2026-10-22.json.gz --check
 *   npm run backup:restore -- sabicars-backup-2026-10-22.json.gz --yes
 *
 * --check only reads the file and prints what it holds. --yes wipes every
 * table in DATABASE_URL and loads the file, parents before children. It
 * refuses a Supabase address unless --production-i-am-sure is also given,
 * because the normal reason to restore is into a fresh database, not over
 * the live one.
 */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import postgres from "postgres";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const check = args.includes("--check");
const yes = args.includes("--yes");
const sure = args.includes("--production-i-am-sure");

if (!file) {
  console.error("Usage: npm run backup:restore -- <file.json.gz> [--check | --yes [--production-i-am-sure]]");
  process.exit(1);
}

const raw = readFileSync(file);
const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const backup = JSON.parse(text) as { format: number; takenAt: string; version: string; tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number> };
if (backup.format !== 2) {
  console.error(`This script restores backup format 2; the file is format ${backup.format}.`);
  process.exit(1);
}
const order = Object.keys(backup.tables);
// Table names come from the file: only plain names are accepted, so nothing in it can become SQL.
const bad = order.filter((t) => !/^[a-z_][a-z0-9_]*$/.test(t));
if (bad.length) {
  console.error(`The file names tables that are not plain identifiers: ${bad.join(", ")}. Refusing it.`);
  process.exit(1);
}
console.log(`Backup taken ${backup.takenAt} from version ${backup.version}: ${order.length} tables, ${Object.values(backup.counts).reduce((a, b) => a + b, 0)} rows.`);
for (const t of order) console.log(`  ${t.padEnd(26)} ${String(backup.counts[t]).padStart(7)}`);
if (check) process.exit(0);
if (!yes) {
  console.error("\nNothing written. Add --yes to load it into DATABASE_URL (which must be an empty database with the schema applied).");
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (or DIRECT_URL).");
  process.exit(1);
}
if (/supabase\.(com|co)/.test(url) && !sure) {
  console.error("That looks like the live database. Restoring over it replaces everything in it. Add --production-i-am-sure if that is really what you want.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const CHUNK = 500;
try {
  const present = new Set((await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`).map((r) => r.table_name as string));
  const missing = order.filter((t) => !present.has(t));
  if (missing.length) {
    console.error(`The target database has no table for: ${missing.join(", ")}. Apply the schema first (npm run db:migrate), from the same version or newer.`);
    process.exit(1);
  }
  await sql.begin(async (tx) => {
    // Children first when wiping, parents first when loading.
    for (const t of [...order].reverse()) await tx.unsafe(`truncate table "${t}" cascade`);
    for (const t of order) {
      const rows = backup.tables[t];
      if (!rows.length) continue;
      // Postgres turns the JSON back into the table's own row type, column by column: timestamps,
      // JSON, arrays, enums and uuids come back exactly as they were exported (format 2).
      for (let i = 0; i < rows.length; i += CHUNK) {
        // Sent as text and parsed by Postgres: a json-typed parameter would be encoded a second time by the driver.
        await tx.unsafe(`insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::text::json)`, [JSON.stringify(rows.slice(i, i + CHUNK))]);
      }
      console.log(`  loaded ${t}: ${rows.length}`);
    }
  });
  console.log("Restored.");
} finally {
  await sql.end();
}
