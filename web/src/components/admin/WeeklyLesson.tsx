"use client";

import { useState, useTransition } from "react";
import { AnswerEditor } from "@/components/admin/AnswerEditor";
import { Button } from "@/components/ui/Button";
import type { AssistantReport } from "@/db/schema";
import { reviewNow } from "@/lib/actions/ask-admin";

/**
 * What the assistant learned this week, for the owner to act on in a minute:
 * the questions buyers asked most, the ones it could not answer with a draft
 * each (publish one and the assistant knows it from then on), the cars people
 * wanted that were not in stock, and the words that lost people.
 */
export function WeeklyLesson({ review }: { review: { report: AssistantReport; conversations: number; periodStart: Date; periodEnd: Date; createdAt: Date } | null }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<number | null>(null);
  const when = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

  return (
    <section className="mt-10 border border-border-subtle bg-surface-1 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">What buyers asked</p>
          <h2 className="mt-2 text-display-3">The assistant&rsquo;s week</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Every Monday the assistant reads the week&rsquo;s chats and reports here. Publish a draft and it knows the answer from then on, and tells
            everyone the same thing.
            {review && (
              <>
                {" "}
                This report: {when(review.periodStart)} to {when(review.periodEnd)}, {review.conversations} chats, written {when(review.createdAt)}.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await reviewNow();
              setNote(r.ok ? (r.reviewed ? `Read ${r.reviewed} chats.` : "No chats in the last 7 days.") : (r.error ?? "Something went wrong."));
            })
          }
        >
          {pending ? "Reading the week…" : "Review the last 7 days now"}
        </Button>
      </div>
      {note && (
        <p role="status" className="mt-3 text-sm text-text-secondary">
          {note}
        </p>
      )}

      {!review ? (
        <p className="mt-6 text-sm text-text-muted">No report yet. The first one arrives on Monday, or press the button.</p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-text-primary">Could not answer — drafts to check and publish</h3>
            {review.report.unanswered.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">Nothing it could not answer this week.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {review.report.unanswered.map((u, i) => (
                  <li key={i} className="border border-border-subtle p-4">
                    <p className="font-medium text-text-primary">{u.question}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Asked {u.timesAsked} {u.timesAsked === 1 ? "time" : "times"}
                    </p>
                    {drafting === i ? (
                      <div className="mt-4">
                        <AnswerEditor initial={{ question: u.question, answer: u.draftAnswer, isPublished: false }} onDone={() => setDrafting(null)} />
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 text-sm whitespace-pre-line text-text-secondary">{u.draftAnswer}</p>
                        <button type="button" onClick={() => setDrafting(i)} className="mt-3 text-sm font-semibold text-green-300 underline-offset-4 hover:underline">
                          Check and publish this answer
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid content-start gap-8">
            <div>
              <h3 className="font-semibold text-text-primary">Asked most</h3>
              <ul className="mt-3 grid gap-1.5 text-sm text-text-secondary">
                {review.report.topQuestions.map((q, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{q.question}</span>
                    <span className="figures shrink-0 text-text-muted">{q.count}</span>
                  </li>
                ))}
                {review.report.topQuestions.length === 0 && <li className="text-text-muted">Nothing stood out.</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Wanted, not in stock</h3>
              <ul className="mt-3 grid gap-1.5 text-sm text-text-secondary">
                {review.report.wantedNotInStock.map((w, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{w.car}</span>
                    <span className="figures shrink-0 text-text-muted">{w.count}</span>
                  </li>
                ))}
                {review.report.wantedNotInStock.length === 0 && <li className="text-text-muted">Nobody asked for a car you did not have.</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Words that lost people</h3>
              <ul className="mt-3 grid gap-3 text-sm">
                {review.report.confusing.map((c, i) => (
                  <li key={i}>
                    <p className="text-text-secondary">&ldquo;{c.what}&rdquo;</p>
                    <p className="mt-1 text-text-primary">Instead: {c.instead}</p>
                  </li>
                ))}
                {review.report.confusing.length === 0 && <li className="text-text-muted">Nothing confused anyone, as far as it could tell.</li>}
              </ul>
            </div>
            {review.report.notes.length > 0 && (
              <div>
                <h3 className="font-semibold text-text-primary">Worth a minute</h3>
                <ul className="mt-3 grid gap-1.5 text-sm text-text-secondary">
                  {review.report.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
