"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAnswer, saveAnswer } from "@/lib/actions/ask-admin";

const field =
  "w-full rounded-lg border border-border-default bg-surface-0 px-3.5 py-2.5 text-text-primary outline-none focus:border-gold-500 focus:shadow-[0_0_0_3px_rgb(201_168_76/0.15)]";

/**
 * One answer for /ask: the question as a buyer would ask it, and the answer
 * staff stand behind. **bold**, *italic*, [links](/path), "- " bullets and
 * "1. " steps are the only formatting — the same as the chat window.
 */
export function AnswerEditor({
  initial,
  conversationId,
  onDone,
}: {
  initial?: { id?: string; question: string; answer: string; isPublished?: boolean; publishedAt?: Date | null };
  conversationId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [publish, setPublish] = useState(initial?.isPublished ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveAnswer({ id: initial?.id, question, answer, conversationId, publish });
      if (!r.ok) return setError(r.error ?? "Could not save.");
      setSaved(true);
      router.refresh();
      onDone?.();
    });

  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Question</span>
        <input
          className={field}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          placeholder="How does the 40% Drive Plan work?"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Answer</span>
        <textarea
          className={`${field} min-h-48 leading-relaxed`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={4000}
        />
        <span className="text-xs text-text-muted">
          Only facts you stand behind — it is public, and the assistant will repeat it. Formatting: **bold**, [link text](/drive-plan), “- ”
          for bullets.
        </span>
      </label>
      <label className="flex items-center gap-2.5 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="size-4 accent-[var(--gold-500)]"
        />
        Published on /ask
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--cta-bg)] px-5 text-sm font-semibold text-[#0A0908] hover:bg-[var(--cta-bg-hover)] disabled:opacity-60"
        >
          {pending ? "Saving…" : initial?.id ? "Save changes" : "Save answer"}
        </button>
        {saved && !pending && <span className="text-sm text-success">Saved.</span>}
        {initial?.id && !initial.publishedAt && (
          <button
            type="button"
            onClick={() =>
              start(async () => {
                const r = await deleteAnswer(initial.id!);
                if (!r.ok) setError(r.error ?? "Could not delete.");
                else router.refresh();
              })
            }
            className="inline-flex min-h-11 items-center px-2 text-sm text-text-muted hover:text-danger"
          >
            Delete draft
          </button>
        )}
      </div>
    </div>
  );
}
