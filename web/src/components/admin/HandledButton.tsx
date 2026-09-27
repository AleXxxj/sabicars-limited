"use client";

import { useTransition } from "react";
import { markConversationHandled } from "@/lib/actions/ask-admin";

export function HandledButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await markConversationHandled(id)))}
      className="inline-flex min-h-10 items-center rounded-full border border-border-default px-4 text-sm text-text-primary hover:border-gold-500/50 disabled:opacity-60"
    >
      {pending ? "…" : "Mark as handled"}
    </button>
  );
}
