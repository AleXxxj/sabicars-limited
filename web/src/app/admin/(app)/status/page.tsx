import type { Metadata } from "next";
import { headers } from "next/headers";
import { inArray } from "drizzle-orm";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { ResolveIncident } from "@/components/admin/IncidentActions";
import { ButtonAnchor } from "@/components/ui/Button";
import { db } from "@/db";
import { staff, type Incident } from "@/db/schema";
import { can, requireStaff } from "@/lib/auth";
import { backupStatus } from "@/lib/backup";
import { openIncidents, recentlyResolved, type IncidentKind } from "@/lib/incidents";
import { launchChecks, type Check } from "@/lib/launch-checks";

export const metadata: Metadata = { title: "System status · Admin", robots: { index: false, follow: false } };

const ICON = {
  ok: <CircleCheck aria-label="Ready" size={20} className="shrink-0 text-success" />,
  warn: <CircleAlert aria-label="Needs attention" size={20} className="shrink-0 text-accent-text" />,
  missing: <CircleX aria-label="Missing" size={20} className="shrink-0 text-danger" />,
};

const KIND_LABEL: Record<IncidentKind, string> = { server: "Server error", client: "Error in a visitor's browser", check: "Deploy check" };
const kindLabel = (kind: string) => KIND_LABEL[kind as IncidentKind] ?? kind;

/* Everything on this page is read in Lagos time: it is where the people reading it are. */
const onDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const atTime = (d: Date) =>
  d.toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

const times = (n: number) => `${n} ${n === 1 ? "time" : "times"}`;
const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

/** The tables a manager thinks in, in the order they would ask about them. */
const BACKUP_TABLES: [key: string, label: string][] = [
  ["vehicles", "vehicles"],
  ["leads", "leads"],
  ["partners", "partners"],
  ["commissions", "commissions"],
  ["payouts", "payouts"],
];

/** The staff behind a set of ids, by name — or email, when no name is on record. */
async function staffNames(ids: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: staff.id, fullName: staff.fullName, email: staff.email }).from(staff).where(inArray(staff.id, wanted));
  return new Map(rows.map((r) => [r.id, r.fullName?.trim() || r.email]));
}

/**
 * Is everything the live site depends on in place? Before launch it is the
 * checklist; after launch it is where to look first when something seems off:
 * every error the site has seen, and whether the copy of the database is
 * recent.
 */
export default async function StatusPage() {
  const me = await requireStaff();
  if (me.role === "sales") return <p className="py-16 text-center text-text-muted">System status is for the owner and managers.</p>;
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [checks, open, resolved, backups] = await Promise.all([launchChecks(base), openIncidents(30), recentlyResolved(10), backupStatus(me.dealerId)]);
  const resolvers = await staffNames(resolved.map((i) => i.resolvedBy).filter((id): id is string => Boolean(id)));
  const missing = checks.filter((c) => c.status === "missing").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const groups = [...new Set(checks.map((c) => c.group))];
  const owner = can.manageStaff(me);

  return (
    <>
      <p className="eyebrow">System status</p>
      <h1 className="mt-2 text-display-3">
        {missing
          ? `${missing} ${missing === 1 ? "thing" : "things"} to set up`
          : open.length
            ? `${open.length} open ${open.length === 1 ? "error" : "errors"}`
            : warn
              ? "Ready, with notes"
              : "Everything is in place"}
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        What the site depends on, checked just now. Keys are never shown here — only whether they are set. Settings are changed in Vercel
        (Project → Settings → Environment Variables) and take effect on the next deploy.
      </p>

      {groups.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="kicker">{g}</h2>
          <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
            {checks
              .filter((c) => c.group === g)
              .map((c: Check) => (
                <li key={c.label} className="flex gap-4 py-4">
                  {ICON[c.status]}
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{c.label}</p>
                    <p className="mt-1 text-sm text-text-secondary">{c.detail}</p>
                    {c.fix && <p className="mt-1.5 text-sm text-green-200">{c.fix}</p>}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section id="errors" className="mt-10 scroll-mt-24" aria-labelledby="errors-heading">
        <h2 id="errors-heading" className="kicker">
          Errors
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary">
          Every error the site has seen — on the server, in a visitor&rsquo;s browser, or in a deploy check — the moment it happened, with how often
          it has repeated. The managers were pushed and emailed when each was first seen. Resolve one once it is dealt with; if it happens again it
          reopens here and the managers are told again.
        </p>

        {open.length === 0 ? (
          <p className="mt-4 flex items-center gap-3 border-y border-border-subtle py-4 text-text-secondary">
            {ICON.ok}
            No open errors.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
            {open.map((i) => (
              <OpenIncident key={i.id} incident={i} />
            ))}
          </ul>
        )}

        {resolved.length > 0 && (
          <>
            <h3 className="mt-8 text-sm font-semibold text-text-secondary">Resolved recently</h3>
            <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle text-sm text-text-muted">
              {resolved.map((i) => (
                <li key={i.id} className="py-3">
                  <p className="text-text-secondary">
                    {i.message}
                    {i.path && (
                      <>
                        {" "}
                        <span className="figures text-text-muted">
                          · {i.method ? `${i.method} ` : ""}
                          {i.path}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="figures mt-0.5">
                    {kindLabel(i.kind)} · {times(i.count)} · resolved{i.resolvedBy && resolvers.get(i.resolvedBy) ? ` by ${resolvers.get(i.resolvedBy)}` : ""}
                    {i.resolvedAt ? ` on ${atTime(i.resolvedAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section id="backups" className="mt-10 scroll-mt-24" aria-labelledby="backups-heading">
        <h2 id="backups-heading" className="kicker">
          Backups
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary">
          A copy of the whole database — every car, enquiry, partner, commission and payment — is taken every week and kept in Sabicars&rsquo; own
          Cloudinary account, as a private file in the backups folder. It does not depend on Supabase. Photos are not in it: they are on Cloudinary
          already.
        </p>

        {backups.lastError && (
          <p role="alert" className="mt-4 text-sm text-danger">
            The last attempt, on {atTime(new Date(backups.lastError.at))}, failed: {backups.lastError.error}
          </p>
        )}

        <dl className="mt-4 grid gap-x-8 gap-y-4 border-y border-border-subtle py-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-muted">Last backup</dt>
            <dd className={`mt-1 font-semibold ${backups.last ? "text-text-primary" : "text-accent-text"}`}>
              {backups.last ? atTime(new Date(backups.last.at)) : "None yet"}
            </dd>
            {backups.last && (
              <dd className="figures mt-0.5 text-sm text-text-secondary">
                {megabytes(backups.last.bytes)} · {backups.last.fileName}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-text-muted">Kept in</dt>
            <dd className="mt-1 font-semibold text-text-primary">Cloudinary, private, backups folder</dd>
            <dd className="mt-0.5 text-sm text-text-secondary">
              {backups.last?.publicId ? (
                <span className="figures break-all">{backups.last.publicId}</span>
              ) : (
                "No public address serves it; only the account's own keys can read it."
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-text-muted">What it holds</dt>
            <dd className="figures mt-1 text-sm text-text-secondary">
              {backups.last
                ? BACKUP_TABLES.map(([key, label]) => `${backups.last?.counts[key] ?? 0} ${label}`).join(" · ")
                : "The counts appear once the first backup has run."}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          {owner ? (
            <>
              <ButtonAnchor href="/admin/status/backup" download variant="secondary">
                Download a backup now
              </ButtonAnchor>
              <p className="mt-3 max-w-2xl text-sm text-text-muted">
                The file is the whole database as it is right now, including partners&rsquo; bank details, so keep it where only you can reach it.
                Each download is on the audit trail. Restoring one is done with <span className="figures">npm run backup:restore</span>.
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">The owner can download a copy at any time.</p>
          )}
        </div>
      </section>
    </>
  );
}

/** One open error: what, where, how often, and the button to close it. */
function OpenIncident({ incident: i }: { incident: Incident }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-danger">{kindLabel(i.kind)}</p>
          <p className="mt-1 font-semibold break-words text-text-primary">{i.message}</p>
          {i.path && (
            <p className="figures mt-1 text-sm break-all text-text-secondary">
              {i.method ? `${i.method} ` : ""}
              {i.path}
            </p>
          )}
          <p className="figures mt-1 text-sm text-text-muted">
            {times(i.count)} · first {onDate(i.firstSeenAt)} · last {atTime(i.lastSeenAt)}
          </p>
          {i.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-text-muted hover:text-text-primary">Technical detail</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-surface-1 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-text-secondary">
                {i.stack}
              </pre>
            </details>
          )}
        </div>
        <ResolveIncident id={i.id} />
      </div>
    </li>
  );
}
