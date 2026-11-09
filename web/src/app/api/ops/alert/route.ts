import { z } from "zod";
import { fromScheduler } from "@/lib/cron";
import { recordIncident, resolveDeployChecks } from "@/lib/incidents";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(1000),
  /** Where the alert points, on this site. */
  url: z.string().trim().max(300).optional(),
  /** "passed": the deploy check is green again, so the deploy failures it reported before are resolved instead of a new one recorded. */
  status: z.enum(["failed", "passed"]).default("failed"),
});

/**
 * A deploy check or an outside monitor reporting a failure. Guarded like the
 * cron routes (Bearer CRON_SECRET): the deploy check holds the secret in its
 * own settings. The failure is recorded as an incident and the managers are
 * pushed and emailed through the same throttled path as every other error.
 * The same check reporting "passed" clears its earlier failures, so a fixed
 * deploy takes its own red badge down (lib/incidents.ts resolveDeployChecks).
 */
export async function POST(request: Request) {
  if (!fromScheduler(request)) return Response.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "title and body are required" }, { status: 400 });
  const { title, body, url, status } = parsed.data;
  if (status === "passed") {
    const resolved = await resolveDeployChecks();
    return Response.json({ ok: true, resolved });
  }
  const result = await recordIncident({ kind: "check", message: `${title}: ${body}`, path: url ?? null });
  return Response.json({ ok: true, recorded: Boolean(result), alerted: result?.alerted ?? false });
}
