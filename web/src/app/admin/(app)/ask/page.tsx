import type { Metadata } from "next";
import Link from "next/link";
import { AnswerEditor } from "@/components/admin/AnswerEditor";
import { requireStaff } from "@/lib/auth";
import { allAnswers } from "@/lib/repositories/ask";

export const metadata: Metadata = { title: "Answers · Admin", robots: { index: false, follow: false } };

/**
 * The public answers on /ask. Each is a page Google can index for the way
 * buyers actually phrase the question — and the assistant reads them back,
 * so what it says and what the site says stay the same.
 */
export default async function AnswersAdmin() {
  const me = await requireStaff();
  if (me.role === "sales") return <p className="py-16 text-center text-text-muted">Answers are managed by the owner and managers.</p>;
  const answers = await allAnswers();

  return (
    <>
      <p className="eyebrow">Ask Sabicars</p>
      <h1 className="mt-2 text-display-3">Answers on /ask</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        Straight answers to what buyers ask, each on its own page for search engines. The best come from real chats — open one in{" "}
        <Link href="/admin/conversations" className="text-gold-300">
          Conversations
        </Link>{" "}
        and publish a reply. A published answer can be unpublished but not deleted, so its link never breaks.
      </p>

      <details className="mt-8 border border-border-subtle bg-surface-1 p-5">
        <summary className="cursor-pointer font-semibold text-text-primary">Write a new answer</summary>
        <div className="mt-5">
          <AnswerEditor />
        </div>
      </details>

      <ul className="mt-6 grid gap-3">
        {answers.map((a) => (
          <li key={a.id}>
            <details className="border border-border-subtle bg-surface-1 p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-text-primary">{a.question}</span>
                <span className="flex items-center gap-3 text-xs">
                  {a.isPublished ? (
                    <Link href={`/ask/${a.slug}`} className="text-success hover:underline">
                      Published ↗
                    </Link>
                  ) : (
                    <span className="text-text-muted">Not published</span>
                  )}
                </span>
              </summary>
              <div className="mt-5">
                <AnswerEditor initial={a} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
