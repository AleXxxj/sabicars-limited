#!/usr/bin/env node
/**
 * Proves a backup restores exactly. Exports the database in DATABASE_URL
 * through the same code the weekly job and the owner's download use
 * (lib/backup.ts), creates an empty database beside it, applies the schema,
 * restores the file into it with scripts/restore-backup.mts, and compares
 * every table — row count and a fingerprint of every row's content — then
 * drops the copy. A backup that restores "almost" the same data is a backup
 * nobody can trust, so any difference fails.
 *
 * Runs in CI on the throwaway database (.github/workflows/e2e.yml) and
 * locally with `npm run test:backup`. It refuses a Supabase address: it
 * creates and drops a database next to the one it reads.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { exportDatabase, packBackup } from "../src/lib/backup";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the database to back up.");
  process.exit(1);
}
if (/supabase/i.test(url)) {
  console.error("Refusing: this check creates and drops a database next to the one it reads. Point DATABASE_URL at a local or throwaway database.");
  process.exit(1);
}

const copyName = `${new URL(url).pathname.slice(1) || "postgres"}_restore_check`;
const copyUrl = (() => {
  const u = new URL(url);
  u.pathname = `/${copyName}`;
  return u.toString();
})();

const admin = postgres(url, { max: 1, prepare: false });
const dir = mkdtempSync(join(tmpdir(), "sabicars-backup-check-"));
let failed = false;

function run(label: string, args: string[], env: Record<string, string>) {
  const r = spawnSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`${label} failed:\n${r.stdout}\n${r.stderr}`);
    throw new Error(`${label} failed`);
  }
}

try {
  console.log("\nExporting through lib/backup.ts");
  const backup = await exportDatabase();
  const { bytes, fileName } = packBackup(backup);
  const file = join(dir, fileName);
  writeFileSync(file, bytes);
  const rows = Object.values(backup.counts).reduce((a, b) => a + b, 0);
  console.log(`  ${Object.keys(backup.tables).length} tables, ${rows} rows, ${(bytes.length / 1024).toFixed(0)} KB compressed`);

  console.log("\nRestoring into an empty database");
  await admin.unsafe(`drop database if exists "${copyName}"`);
  await admin.unsafe(`create database "${copyName}"`);
  run("Applying the schema", ["scripts/migrate.mjs"], { DATABASE_URL: copyUrl, DIRECT_URL: copyUrl });
  run("The restore", ["--import", "tsx", "scripts/restore-backup.mts", file, "--yes"], { DATABASE_URL: copyUrl, DIRECT_URL: copyUrl });

  console.log("\nComparing every table, row for row");
  const copy = postgres(copyUrl, { max: 1, prepare: false });
  try {
    const tables = (await admin`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`).map((r) => r.table_name as string);
    for (const t of tables) {
      const q = `select count(*)::int as n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text))), '') as h from "${t}" x`;
      const [[a], [b]] = await Promise.all([admin.unsafe(q), copy.unsafe(q)]);
      const same = a.n === b.n && a.h === b.h;
      if (!same) failed = true;
      console.log(`  ${same ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${t.padEnd(26)} ${String(a.n).padStart(6)} ${same ? "" : `→ ${b.n} rows, content ${a.h === b.h ? "same" : "differs"}`}`);
    }
  } finally {
    await copy.end();
  }
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await admin.unsafe(`drop database if exists "${copyName}" with (force)`).catch(() => {});
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? "\n\x1b[31mBACKUP DOES NOT RESTORE EXACTLY\x1b[0m\n" : "\nEvery table restored exactly.  \x1b[32mBackup verified.\x1b[0m\n");
process.exit(failed ? 1 : 0);
