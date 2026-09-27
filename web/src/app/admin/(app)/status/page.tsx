import type { Metadata } from "next";
import { headers } from "next/headers";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { launchChecks, type Check } from "@/lib/launch-checks";

export const metadata: Metadata = { title: "System status · Admin", robots: { index: false, follow: false } };

const ICON = {
  ok: <CircleCheck aria-label="Ready" size={20} className="shrink-0 text-success" />,
  warn: <CircleAlert aria-label="Needs attention" size={20} className="shrink-0 text-accent-text" />,
  missing: <CircleX aria-label="Missing" size={20} className="shrink-0 text-danger" />,
};

/**
 * Is everything the live site depends on in place? Before launch it is the
 * checklist; after launch it is where to look first when something seems off.
 */
export default async function StatusPage() {
  const me = await requireStaff();
  if (me.role === "sales") return <p className="py-16 text-center text-text-muted">System status is for the owner and managers.</p>;
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const checks = await launchChecks(base);
  const missing = checks.filter((c) => c.status === "missing").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const groups = [...new Set(checks.map((c) => c.group))];

  return (
    <>
      <p className="eyebrow">System status</p>
      <h1 className="mt-2 text-display-3">
        {missing ? `${missing} ${missing === 1 ? "thing" : "things"} to set up` : warn ? "Ready, with notes" : "Everything is in place"}
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
                    {c.fix && <p className="mt-1.5 text-sm text-gold-200">{c.fix}</p>}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
