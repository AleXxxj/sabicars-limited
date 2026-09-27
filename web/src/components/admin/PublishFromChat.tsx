"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { AnswerEditor } from "./AnswerEditor";

/** A good reply in a real chat, turned into a public answer on /ask — edited first. */
export function PublishFromChat({ question, answer, conversationId }: { question: string; answer: string; conversationId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-gold-300 hover:text-gold-200"
      >
        <Globe aria-hidden size={14} /> Publish as an answer on /ask
      </button>
    );
  return (
    <div className="mt-3 rounded-xl border border-gold-500/30 bg-surface-0 p-4">
      <AnswerEditor initial={{ question, answer, isPublished: false }} conversationId={conversationId} onDone={() => setOpen(false)} />
    </div>
  );
}
