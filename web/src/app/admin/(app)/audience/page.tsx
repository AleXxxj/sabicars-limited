import type { Metadata } from "next";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { requireStaff } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { oneSignalConfigured } from "@/lib/notifications";
import { announceableVehicles, audienceSummary, recentNotifications, recentSends, recentSubscribers } from "@/lib/repositories/audience";

export const metadata: Metadata = { title: "Audience · Admin", robots: { index: false, follow: false } };

const when = (d: Date) =>
  new Date(d).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  });

const SOURCE: Record<string, string> = {
  legacy: "old site",
  footer: "site footer",
  prompt: "prompt",
  article: "article",
  page: "page",
  unknown: "unknown",
};
const KIND: Record<string, string> = {
  arrival: "New arrival",
  price_drop: "Price drop",
  blog: "Article",
  offer: "Offer",
  system: "Notice",
  car: "New arrival (old site)",
};

/**
 * Everyone who asked to hear from Sabicars, and everything they were told.
 *
 * Its one job: show that the audience is being kept warm without anyone having
 * to remember to do it — arrivals and price drops announce themselves, the
 * newsletter goes every Friday — and give managers one place to send an offer.
 */
export default async function AudienceAdmin() {
  const me = await requireStaff();
  const [summary, posts, sends, subs, cars] = await Promise.all([
    audienceSummary(me.dealerId),
    recentNotifications(me.dealerId),
    recentSends(me.dealerId),
    recentSubscribers(me.dealerId),
    announceableVehicles(me.dealerId),
  ]);
  const pushReady = oneSignalConfigured();
  const emailReady = emailConfigured();

  return (
    <>
      <p className="eyebrow">Audience</p>
      <h1 className="mt-2 text-display-3">Everyone who asked to hear from you</h1>

      <dl className="mt-8 grid grid-cols-2 gap-px border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {[
          { label: "Newsletter subscribers", value: String(summary.active), note: `${summary.joined30} joined in 30 days` },
          { label: "Unsubscribed", value: String(summary.unsubscribed), note: "one click, from any email" },
          {
            label: "Phone alerts",
            value: pushReady ? "On" : "Not set up",
            note: pushReady ? "arrivals and price drops push automatically" : "needs ONESIGNAL_REST_API_KEY",
          },
          {
            label: "Email",
            value: emailReady ? "On" : "Not set up",
            note: emailReady ? "new arrivals every Friday, 9am" : "needs the Resend key and domain",
          },
        ].map((f) => (
          <div key={f.label} className="bg-surface-1 p-4 md:p-5">
            <dt className="text-xs text-text-muted">{f.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-text-primary">{f.value}</dd>
            <dd className="mt-0.5 text-xs text-text-muted">{f.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-label="Post an announcement" className="border border-border-subtle bg-surface-1 p-5 md:p-6">
          <p className="text-sm font-semibold text-text-primary">Post an announcement</p>
          <p className="mt-1 text-xs text-text-muted">
            For offers and news. New arrivals and price drops are posted automatically — no need to post them here.
          </p>
          <div className="mt-5">
            {me.role === "sales" ? (
              <p className="text-sm text-text-muted">A manager sends announcements.</p>
            ) : (
              <AnnouncementForm vehicles={cars} subscribers={summary.active} pushReady={pushReady} emailReady={emailReady} />
            )}
          </div>
        </section>

        <section aria-label="Newsletters">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-semibold text-text-primary">Newsletters</p>
            <a href="/admin/audience/preview" target="_blank" className="text-xs font-semibold text-accent-text hover:text-text-primary">
              Preview this Friday&rsquo;s email ↗
            </a>
          </div>
          {sends.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">None sent yet. The first goes out on Friday if cars arrived that week.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-subtle">
              {sends.map((s) => (
                <li key={s.id} className="py-3 text-sm">
                  <p className="text-text-primary">{s.subject}</p>
                  <p className={`mt-0.5 text-xs ${s.status === "failed" ? "text-danger" : "text-text-muted"}`}>
                    {s.kind === "digest" ? "Weekly digest" : "Broadcast"} · {when(s.sentAt ?? s.createdAt)} ·{" "}
                    {s.status === "sent"
                      ? `sent to ${s.recipients}${s.failed ? `, ${s.failed} failed` : ""}`
                      : s.status === "skipped"
                        ? "skipped — no new arrivals"
                        : s.status === "sending"
                          ? "sending…"
                          : `failed: ${s.error}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Recent posts" className="mt-12">
        <p className="text-sm font-semibold text-text-primary">On the bell</p>
        <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
          {posts.map((n) => (
            <li key={n.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
              <div className="min-w-0">
                <p className="truncate text-text-primary">{n.title}</p>
                <p className="text-xs text-text-muted">
                  {KIND[n.kind] ?? n.kind} · {when(n.createdAt)} ·{" "}
                  {n.by ? `posted by ${n.by}` : n.legacyId ? "old site" : "posted automatically"}
                </p>
              </div>
              <p className={`text-xs sm:text-right ${n.pushError && n.pushError !== "not_configured" ? "text-danger" : "text-text-muted"}`}>
                {n.pushedAt
                  ? `Pushed${n.pushRecipients !== null ? ` to ${n.pushRecipients}` : ""}`
                  : n.pushError === "not_configured"
                    ? "Not pushed — alerts not set up"
                    : n.pushError
                      ? `Push failed: ${n.pushError.slice(0, 60)}`
                      : n.legacyId
                        ? ""
                        : "Bell only"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Subscribers" className="mt-12">
        <p className="text-sm font-semibold text-text-primary">Newest subscribers</p>
        {summary.bySource.length > 0 && (
          <p className="mt-1 text-xs text-text-muted">
            Where they signed up: {summary.bySource.map((s) => `${SOURCE[s.source] ?? s.source} ${s.n}`).join(" · ")}
          </p>
        )}
        <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
          {subs.map((s) => (
            <li key={s.email} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5 text-sm">
              <span className={`break-all ${s.isActive ? "text-text-primary" : "text-text-muted line-through"}`}>
                {s.email}
                {s.name && <span className="ml-2 text-text-muted">{s.name}</span>}
              </span>
              <span className="text-xs text-text-muted">
                {SOURCE[s.source ?? "unknown"] ?? s.source} · {when(s.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
