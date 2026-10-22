import { exportDatabase, packBackup } from "@/lib/backup";
import { audit } from "@/lib/audit";
import { can, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * "Download a backup now": the whole database as one compressed file, for
 * the owner only — it holds every enquiry and every partner's bank details.
 * Each download is on the audit trail.
 */
export async function GET() {
  const me = await requireStaff();
  if (!can.manageStaff(me)) return new Response("The owner downloads backups.", { status: 403 });
  const backup = await exportDatabase();
  const { bytes, fileName, sha256 } = packBackup(backup);
  await audit(me, "backup", backup.takenAt, "download", { fileName, bytes: bytes.length, sha256 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
      "X-Backup-SHA256": sha256,
    },
  });
}
