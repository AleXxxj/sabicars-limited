"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp } from "lucide-react";
import { replyInConversation } from "@/lib/actions/ask-admin";

/** How often the buyer's screen is told the person is still typing; under the sign's own life (TYPING_TTL_SECONDS). */
const TYPING_EVERY_MS = 2_000;

/**
 * The team's side of a "Chat with seller" room: a reply box under the
 * transcript. What is sent appears on the buyer's phone within a couple of
 * seconds, under the sender's first name, and Sabi stays quiet while they are
 * in the room. While a reply is being typed the buyer sees "typing…".
 */
export function ChatReply({ conversationId, name, waiting, onSent }: { conversationId: string; name: string; waiting: boolean; onSent?: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);
  const typingSentAt = useRef(0);
  const typingOn = useRef(false);

  const signalTyping = (on: boolean) => {
    const now = Date.now();
    if (on && now - typingSentAt.current < TYPING_EVERY_MS) return;
    if (!on && !typingOn.current) return;
    typingSentAt.current = on ? now : 0;
    typingOn.current = on;
    void fetch(`/api/admin/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typing: on }),
      keepalive: true,
    }).catch(() => {});
  };

  // Leaving the chat mid-sentence: the buyer must not see "typing…" for someone who has gone.
  useEffect(() => () => {
    if (typingOn.current) signalTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = () => {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    start(async () => {
      const r = await replyInConversation(conversationId, message);
      if (r.ok) {
        setText("");
        // The reply itself clears the typing sign on the server.
        typingOn.current = false;
        typingSentAt.current = 0;
        onSent?.();
        field.current?.focus();
      } else {
        setError(r.error ?? "Could not send that.");
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={`sticky bottom-4 grid gap-2 rounded-2xl border p-3 backdrop-blur ${waiting ? "border-orange-400/50 bg-surface-1/95" : "border-border-default bg-surface-1/95"}`}
    >
      <p className="px-1 text-xs text-text-muted">
        {waiting ? "The buyer is waiting for a person. " : ""}
        Replying as <span className="font-semibold text-text-primary">{name}</span>. They see it on their phone within seconds.
      </p>
      <div className="flex items-end gap-2">
        <textarea
          ref={field}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            signalTyping(e.target.value.trim().length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={1500}
          placeholder="Write to the buyer…"
          aria-label="Your reply to the buyer"
          className="min-h-11 flex-1 resize-none rounded-xl border border-border-default bg-surface-2/70 px-3 py-2.5 text-[1rem] text-text-primary outline-none placeholder:text-text-muted focus:border-green-500/70"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label="Send"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--orange-400),var(--orange-500))] text-[#090E0A] disabled:opacity-35"
        >
          <ArrowUp aria-hidden size={20} strokeWidth={2.4} />
        </button>
      </div>
      {error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
