import type { Metadata } from "next";
import Link from "next/link";
import { CommentControls } from "@/components/admin/CommentControls";
import { requireStaff } from "@/lib/auth";
import { adminPosts, pendingComments } from "@/lib/repositories/blog";

export const metadata: Metadata = { title: "Insights · Admin", robots: { index: false, follow: false } };

const when = (d: Date) =>
  new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

/**
 * The articles, and the comments waiting under them.
 *
 * Its one job: keep Insights publishing — so a salesperson's hard-won answer
 * becomes an article that answers the next thousand buyers — and keep the
 * comments worth reading.
 */
export default async function BlogAdmin() {
  const me = await requireStaff();
  const [posts, comments] = await Promise.all([adminPosts(me.dealerId), pendingComments(me.dealerId)]);
  const canEdit = me.role !== "sales";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Insights</p>
          <h1 className="mt-2 text-display-3">Articles</h1>
        </div>
        {canEdit && (
          <Link
            href="/admin/blog/new"
            className="inline-flex min-h-11 items-center bg-cta px-5 text-sm font-semibold text-cta-fg hover:bg-cta-hover"
          >
            Write an article
          </Link>
        )}
      </div>

      {comments.length > 0 && (
        <section aria-label="Comments waiting" className="mt-8 border border-gold-700 bg-surface-1 p-5 md:p-6">
          <p className="text-sm font-semibold text-text-primary">
            {comments.length} {comments.length === 1 ? "comment is" : "comments are"} waiting to be read
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Publish anything genuine — including questions and disagreement. Hide spam and abuse.
          </p>
          <ul className="mt-4 grid gap-3">
            {comments.map((c) => (
              <li key={c.id} className="grid gap-3 border-t border-border-subtle pt-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-text-primary">{c.message}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {c.name} · {when(c.createdAt)} · on{" "}
                    <Link href={`/blog/${c.slug}`} target="_blank" className="hover:text-text-primary">
                      {c.post}
                    </Link>
                  </p>
                </div>
                {canEdit && <CommentControls commentId={c.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
        {posts.map((p) => {
          const reactions = Object.values(p.reactions ?? {}).reduce((n, v) => n + (Number(v) || 0), 0);
          return (
            <li key={p.id}>
              <Link
                href={`/admin/blog/${p.id}`}
                className="grid gap-1 py-4 hover:bg-surface-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6 sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{p.title}</span>
                  <span className="block text-xs text-text-muted">
                    {p.category} · {p.isPublished ? `published ${when(p.publishedAt ?? p.updatedAt)}` : "draft"}
                    {p.isFeatured && " · featured"}
                  </span>
                </span>
                <span className="figures text-xs text-text-muted sm:text-right">
                  {p.isPublished ? (
                    `${p.views} reads · ${reactions} reactions · ${p.shares} shares`
                  ) : (
                    <span className="text-accent-text">Not published</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
