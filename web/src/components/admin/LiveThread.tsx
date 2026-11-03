"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatReply } from "./ChatReply";
import { PublishFromChat } from "./PublishFromChat";

/** A line of the chat as the page hands it over and as the live feed adds to it. */
export interface ThreadLine {
  id: string;
  role: "user" | "assistant" | "staff";
  /** Sabi's lines with their directives described; everyone else's as written. */
  text: string;
  /** Sabi's line as written, for publishing it as a public answer. */
  raw?: string;
  staffName: string | null;
  /** ISO. */
  at: string;
}

/** The feed follows the room this often while the screen is on. */
const POLL_MS = 2_000;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/**
 * The transcript of a chat in the admin, kept live: every couple of seconds
 * it asks the room for anything written since the last line it has, so a
 * buyer's message appears as it lands, not on the next page reload; it shows
 * "typing…" while the buyer types; and in a seller room it carries the reply
 * box, whose reply shows the moment it is sent.
 *
 * The page's own render stays the source of the first lines (and of any
 * reload); the feed only ever adds lines the page has not got yet.
 */
export function LiveThread({
  conversationId,
  initial,
  seller,
  canRead,
  canPublish,
  replyAs,
  waiting: waitingAtFirst,
}: {
  conversationId: string;
  initial: ThreadLine[];
  seller: boolean;
  canRead: boolean;
  canPublish: boolean;
  /** The first name the reply goes out under. */
  replyAs: string;
  waiting: boolean;
}) {
  const [extra, setExtra] = useState<ThreadLine[]>([]);
  const [buyerTyping, setBuyerTyping] = useState(false);
  const [waiting, setWaiting] = useState(waitingAtFirst);
  const [tick, setTick] = useState(0);

  // Everything on screen: the page's lines and the feed's, no line twice, oldest first.
  const lines = useMemo(() => {
    const seen = new Set(initial.map((l) => l.id));
    return [...initial, ...extra.filter((l) => !seen.has(l.id))].sort((a, b) => a.at.localeCompare(b.at));
  }, [initial, extra]);
  // The newest line's time, for the feed to ask "anything after this?" without re-arming on every line.
  const newest = useRef<string | null>(null);
  useEffect(() => {
    newest.current = lines.at(-1)?.at ?? null;
  }, [lines]);

  const poll = useCallback(async () => {
    if (!canRead || document.visibilityState !== "visible") return;
    try {
      const q = newest.current ? `?after=${encodeURIComponent(newest.current)}` : "";
      const res = await fetch(`/api/admin/conversations/${conversationId}/live${q}`, { cache: "no-store" });
      if (!res.ok || res.redirected) return;
      const body = (await res.json()) as { messages: ThreadLine[]; awaiting: boolean; buyerTyping: boolean };
      if (body.messages.length) {
        setExtra((prev) => {
          const have = new Set(prev.map((l) => l.id));
          return [...prev, ...body.messages.filter((l) => !have.has(l.id))];
        });
      }
      setBuyerTyping(Boolean(body.buyerTyping));
      setWaiting(Boolean(body.awaiting));
    } catch {
      /* A missed look is nothing; the next one catches up. */
    }
  }, [conversationId, canRead]);

  useEffect(() => {
    if (!canRead) return;
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, tick, canRead]);

  return (
    <>
      {lines.map((m, i) => {
        const prev = lines[i - 1];
        if (m.role === "user")
          return (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-green-500/25 bg-green-500/[0.1] px-4 py-3">
              <p className="whitespace-pre-wrap text-text-primary">{m.text}</p>
              <p className="mt-1 text-right text-[0.7rem] text-text-muted">{when(m.at)}</p>
            </div>
          );
        if (m.role === "staff")
          return (
            <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-orange-400/30 bg-orange-500/[0.06] px-4 py-3">
              <p className="text-[0.7rem] font-semibold tracking-wide text-orange-200 uppercase">
                {m.staffName ?? "Sabicars team"} · {when(m.at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-text-primary">{m.text}</p>
            </div>
          );
        return (
          <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-border-subtle bg-surface-1 px-4 py-3">
            <p className="text-[0.7rem] font-semibold tracking-wide text-green-300 uppercase">Sabi · {when(m.at)}</p>
            <p className="mt-1 whitespace-pre-wrap text-text-secondary">{m.text}</p>
            {canPublish && prev?.role === "user" && (
              <PublishFromChat question={prev.text} answer={(m.raw ?? m.text).replace(/\[\[[^\]]*\]\]/g, "").trim()} conversationId={conversationId} />
            )}
          </div>
        );
      })}

      {buyerTyping && (
        <p role="status" className="ml-auto flex items-center gap-2 text-sm text-text-muted">
          The buyer is typing
          <span aria-hidden className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="ask-dot size-1.5 rounded-full bg-green-400" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </span>
        </p>
      )}

      {seller && <ChatReply conversationId={conversationId} name={replyAs} waiting={waiting} onSent={() => setTick((t) => t + 1)} />}
    </>
  );
}
