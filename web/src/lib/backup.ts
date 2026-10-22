import "server-only";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { alertManagers } from "@/lib/alerts";
import { sabicarsDealerId } from "@/lib/leads";

/**
 * A copy of the whole database that Sabicars holds itself.
 *
 * Supabase keeps its own backups, and a paid plan keeps them daily; this is
 * the copy that does not depend on Supabase at all. Every table is read and
 * written out as JSON, compressed, and (a) put in Sabicars' own Cloudinary
 * account every week, as a private file, by /api/cron/backup, and (b)
 * downloadable at any moment by the owner from the status page.
 * scripts/restore-backup.mts loads such a file into an empty database.
 *
 * Photos are not in it: they live on Cloudinary already and the rows here
 * point at them.
 */

/**
 * 2: every row is exactly as Postgres renders it with row_to_json — timestamps
 * keep their microseconds, JSON columns stay JSON, arrays stay arrays — and a
 * restore turns it back with json_populate_recordset, so every column type
 * round-trips unchanged (proved by restoring into an empty database and
 * comparing every table row for row). Format 1 read rows through JavaScript
 * and lost both; it was never used for a real backup.
 */
export const BACKUP_FORMAT = 2 as const;

/**
 * The order a restore inserts in: parents before children, so every foreign
 * key finds its row. A table missing from this list is restored last.
 */
export const TABLE_ORDER = [
  "dealers",
  "locations",
  "consignors",
  "staff",
  "vehicles",
  "vehicle_media",
  "inspections",
  "leads",
  "vehicle_requests",
  "request_matches",
  "vehicle_watches",
  "lead_activity",
  "push_subscriptions",
  "partners",
  "commissions",
  "payouts",
  "reviews",
  "blog_posts",
  "blog_comments",
  "subscribers",
  "notifications",
  "newsletter_sends",
  "settings",
  "assistant_conversations",
  "assistant_messages",
  "ask_answers",
  "audit_log",
  "incidents",
] as const;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  takenAt: string;
  /** The commit the site was running. */
  version: string;
  /** Table name → rows, in restore order. */
  tables: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
}

/** Every table in the public schema, in restore order. */
export async function tableNames(): Promise<string[]> {
  const rows = (await db.execute(
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  )) as unknown as { table_name: string }[];
  const names = rows.map((r) => r.table_name);
  const known = TABLE_ORDER.filter((t) => names.includes(t)) as string[];
  return [...known, ...names.filter((n) => !known.includes(n))];
}

/**
 * Reads the whole database, each row exactly as Postgres renders it as JSON,
 * so nothing passes through a JavaScript Date or a re-encoded string on the
 * way out. All tables are read in one repeatable-read transaction, so the
 * copy is one consistent moment even while the site keeps taking enquiries.
 */
export async function exportDatabase(): Promise<Backup> {
  const tables: Backup["tables"] = {};
  const counts: Backup["counts"] = {};
  const names = await tableNames();
  await db.transaction(
    async (tx) => {
      for (const name of names) {
        const [row] = (await tx.execute(
          sql`select coalesce(json_agg(row_to_json(t)), '[]'::json) as rows from ${sql.identifier(name)} t`,
        )) as unknown as { rows: Record<string, unknown>[] | string }[];
        const rows = typeof row.rows === "string" ? (JSON.parse(row.rows) as Record<string, unknown>[]) : row.rows;
        tables[name] = rows;
        counts[name] = rows.length;
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return {
    format: BACKUP_FORMAT,
    takenAt: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    tables,
    counts,
  };
}

/** The backup as the file it is kept as: JSON, gzip-compressed. */
export function packBackup(backup: Backup): { bytes: Buffer; fileName: string; sha256: string } {
  const bytes = gzipSync(Buffer.from(JSON.stringify(backup)), { level: 9 });
  const day = backup.takenAt.slice(0, 10);
  return { bytes, fileName: `sabicars-backup-${day}.json.gz`, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Cloudinary's free plan refuses a raw file above 10 MB; we stop a little short of it. */
const CLOUDINARY_RAW_LIMIT = 9_500_000;

export interface BackupRecord {
  at: string;
  fileName: string;
  bytes: number;
  sha256: string;
  publicId: string | null;
  counts: Record<string, number>;
}

/** Puts the file in Sabicars' own Cloudinary account as a private ("authenticated") raw asset: no public address serves it. */
export async function uploadBackup(fileName: string, bytes: Buffer): Promise<{ publicId: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured, so the backup has nowhere to go.");
  if (bytes.length > CLOUDINARY_RAW_LIMIT) throw new Error(`The backup is ${(bytes.length / 1e6).toFixed(1)} MB, above what the Cloudinary plan accepts for one file. Download it from the status page instead.`);
  const params: Record<string, string | number> = { public_id: `backups/${fileName}`, timestamp: Math.floor(Date.now() / 1000), type: "authenticated" };
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1").update(payload + apiSecret).digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: "application/gzip" }), fileName);
  for (const [k, v] of Object.entries(params)) form.set(k, String(v));
  form.set("api_key", apiKey);
  form.set("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  const body = (await res.json().catch(() => null)) as { public_id?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.public_id) throw new Error(`Cloudinary refused the backup: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  return { publicId: body.public_id };
}

const LAST_KEY = "backup:last";
const ERROR_KEY = "backup:last_error";

/** The weekly job: export, compress, store in Cloudinary, note the result; tell the managers if it fails. */
export async function runBackup(): Promise<{ ok: true; record: BackupRecord } | { ok: false; error: string }> {
  const dealerId = await sabicarsDealerId();
  try {
    const backup = await exportDatabase();
    const { bytes, fileName, sha256 } = packBackup(backup);
    const { publicId } = await uploadBackup(fileName, bytes);
    const record: BackupRecord = { at: backup.takenAt, fileName, bytes: bytes.length, sha256, publicId, counts: backup.counts };
    await db
      .insert(settings)
      .values({ dealerId, key: LAST_KEY, value: record })
      .onConflictDoUpdate({ target: [settings.dealerId, settings.key], set: { value: record, updatedAt: new Date() } });
    await db.delete(settings).where(sql`${settings.dealerId} = ${dealerId} and ${settings.key} = ${ERROR_KEY}`);
    return { ok: true, record };
  } catch (e) {
    const error = e instanceof Error ? e.message : "The backup failed.";
    console.error("[backup] failed", error);
    await db
      .insert(settings)
      .values({ dealerId, key: ERROR_KEY, value: { at: new Date().toISOString(), error } })
      .onConflictDoUpdate({ target: [settings.dealerId, settings.key], set: { value: { at: new Date().toISOString(), error }, updatedAt: new Date() } });
    await alertManagers(dealerId, {
      title: "The weekly backup failed",
      body: `${error} Until it succeeds, download a copy from the status page.`,
      url: "/admin/status#backups",
      tag: "backup-failed",
      action: "Open system status",
    });
    return { ok: false, error };
  }
}

/** What the status page shows: the last successful backup and the last failure, if any. */
export async function backupStatus(dealerId: string): Promise<{ last: BackupRecord | null; lastError: { at: string; error: string } | null }> {
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings).where(eq(settings.dealerId, dealerId));
  const last = (rows.find((r) => r.key === LAST_KEY)?.value as BackupRecord | undefined) ?? null;
  const lastError = (rows.find((r) => r.key === ERROR_KEY)?.value as { at: string; error: string } | undefined) ?? null;
  return { last, lastError };
}
