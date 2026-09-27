#!/usr/bin/env node
/**
 * The launch checklist, printed: the same checks as /admin/status.
 *
 *   npm run check:launch                        (this copy, with .env.local, against localhost:3000)
 *   npm run check:launch -- https://preview.url (another copy's pages; settings still come from .env.local)
 */
const { launchChecks } = await import("../src/lib/launch-checks");
const base = process.argv[2] ?? "http://localhost:3000";
const checks = await launchChecks(base);
const mark = { ok: "✓", warn: "!", missing: "✗" } as const;
let group = "";
for (const c of checks) {
  if (c.group !== group) console.log(`\n${(group = c.group).toUpperCase()}`);
  console.log(`  ${mark[c.status]} ${c.label} — ${c.detail}${c.fix ? `\n      → ${c.fix}` : ""}`);
}
const missing = checks.filter((c) => c.status === "missing").length;
console.log(`\n${missing ? `${missing} missing.` : "Nothing missing."} ${checks.filter((c) => c.status === "warn").length} to look at.`);
process.exit(missing ? 1 : 0);
