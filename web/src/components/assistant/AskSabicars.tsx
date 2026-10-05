"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ArrowUp, MessageCircle, Phone, PhoneCall, RotateCcw, X } from "lucide-react";
import { SYMBOL } from "@/components/brand/marks";
import { ASK_EVENT, type AskRequest } from "@/lib/assistant/open";
import type { Part } from "@/lib/assistant/parts";
import { site, whatsappLink } from "@/lib/site";
import { CallbackForm, CarCards, CompareCard } from "./AssistantParts";
import { MessageText } from "./MessageText";

/** The races are only fetched when a reply shows one, so the chat stays light on every other page. */
const ChatRace = dynamic(() => import("./ChatRace").then((m) => m.ChatRace), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-white/[0.04]" />,
});

interface Msg {
  id: string;
  role: "user" | "assistant";
  parts: Part[];
}

const CONVERSATION_KEY = "sc_ask_conversation";
const MESSAGES_KEY = "sc_ask_messages";

/** Read once, lazily: the widget renders nothing from storage until it is opened, so the server's markup always matches. */
function stored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing: the chat still works, it just forgets on reload. */
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

function suggestionsFor(path: string): string[] {
  if (/^\/vehicles\/[a-z0-9-]+$/.test(path))
    return [
      "Tell me about this car",
      "What would I pay down on the Drive Plan?",
      "Compare it with something similar",
      "Can I inspect it before I pay?",
    ];
  if (path.startsWith("/hummer-bus"))
    return ["Which Hummer buses do you have?", "Hummer 2 or Hummer 3 — what's the difference?", "Can a bus pay for itself?"];
  if (path.startsWith("/drive-plan"))
    return ["How does the 40% Drive Plan work?", "What can ₦10m reach on the Drive Plan?", "Who approves the finance?"];
  return [
    "A family SUV under ₦30 million",
    "Which Hummer buses are in stock?",
    "How does the 40% Drive Plan work?",
    "Compare two cars for me",
  ];
}

function Avatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(160deg,var(--gold-200),var(--gold-500)_60%,var(--gold-700))] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="20 6 80 108" width={size * 0.6} height={size * 0.6}>
        <path d={SYMBOL.solid} fill="#0A0908" />
      </svg>
    </span>
  );
}

/**
 * Ask Sabicars: the showroom's best salesperson, in a chat window, at 2am.
 *
 * It never opens by itself — a panel springing over the page on arrival is
 * the most disliked pattern on a dealer's site — and it is always in the same
 * corner for whoever wants it. It says plainly that it is an AI, and a person
 * is always one tap away.
 *
 * The conversation survives moving between pages and a reload (sessionStorage),
 * and is forgotten when the tab closes.
 */
export function AskSabicars() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => stored<Msg[]>(MESSAGES_KEY, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for what renders (the callback form files against it); a ref for the request in flight.
  const [conversationId, setConversationId] = useState<string | null>(() => stored<string | null>(CONVERSATION_KEY, null));
  const conversation = useRef(conversationId);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const stick = useRef(true);
  const lastTop = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => remember(MESSAGES_KEY, msgs.length ? msgs.slice(-60) : null), [msgs]);

  // Follow the reply as it streams in — unless the reader has scrolled up to reread.
  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);

  useEffect(() => {
    if (!open) return;
    field.current?.focus({ preventScroll: true });
    document.documentElement.classList.add("ask-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("ask-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busyRef.current) return;
      busyRef.current = true;
      const reply = uid();
      stick.current = true;
      setError(null);
      setInput("");
      setBusy(true);
      setMsgs((m) => [
        ...m,
        { id: uid(), role: "user", parts: [{ kind: "text", text: message }] },
        { id: reply, role: "assistant", parts: [] },
      ]);
      const update = (fn: (parts: Part[]) => Part[]) => setMsgs((m) => m.map((x) => (x.id === reply ? { ...x, parts: fn(x.parts) } : x)));

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conversationId: conversation.current, path: pathname }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Ask Sabicars can’t answer right now — please call or WhatsApp us.");
        }
        // Newline-delimited JSON. A read can end mid-line, so the unfinished tail waits for the next one.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: { type: string; text?: string; part?: Part; conversationId?: string; error?: string };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === "id" && event.conversationId) {
              conversation.current = event.conversationId;
              setConversationId(event.conversationId);
              remember(CONVERSATION_KEY, event.conversationId);
            } else if (event.type === "text" && event.text) {
              const chunk = event.text;
              update((parts) => {
                const last = parts.at(-1);
                return last?.kind === "text"
                  ? [...parts.slice(0, -1), { kind: "text", text: last.text + chunk }]
                  : [...parts, { kind: "text", text: chunk }];
              });
            } else if (event.type === "part" && event.part) {
              const part = event.part;
              update((parts) => [...parts, part]);
            } else if (event.type === "error") {
              setError(event.error ?? "Something went wrong.");
            }
          }
        }
      } catch (e) {
        // An empty reply bubble would look like being ignored: remove it.
        setMsgs((m) => m.filter((x) => x.id !== reply || x.parts.length));
        setError(e instanceof Error ? e.message : "Ask Sabicars can’t answer right now.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [pathname],
  );

  // Other parts of the site open the chat, sometimes with a question already asked.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const prompt = (e as CustomEvent<AskRequest>).detail?.prompt;
      setOpen(true);
      if (prompt) void send(prompt);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [send]);

  // A link can carry a question: sabicars.com/?ask=Which+Hummer+buses+do+you+have
  useEffect(() => {
    const url = new URL(window.location.href);
    const prompt = url.searchParams.get("ask")?.trim().slice(0, 300);
    if (!prompt) return;
    url.searchParams.delete("ask");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const t = window.setTimeout(() => {
      setOpen(true);
      void send(prompt);
    }, 400);
    return () => window.clearTimeout(t);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setMsgs([]);
    setError(null);
    conversation.current = null;
    setConversationId(null);
    remember(CONVERSATION_KEY, null);
    field.current?.focus();
  };

  const offerCallback = () => {
    stick.current = true;
    setMsgs((m) => [
      ...m,
      {
        id: uid(),
        role: "assistant",
        parts: [
          { kind: "text", text: "Of course. Leave your name and number and someone from the team will call you." },
          { kind: "callback" },
        ],
      },
    ]);
  };

  const suggestions = suggestionsFor(pathname);
  const last = msgs.at(-1);
  const waiting = busy && last?.role === "assistant" && !last.parts.length;

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ask-sabicars"
        aria-label={open ? "Close Ask Sabicars" : "Ask Sabicars a question"}
        className={`ask-launcher group fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 rounded-full border border-gold-500/35 bg-surface-1/90 p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8),0_0_0_6px_rgb(201_168_76/0.06)] backdrop-blur-md transition-[transform,opacity] duration-300 hover:border-gold-400/60 sm:pr-5 xl:right-6 xl:bottom-6 ${open ? "pointer-events-none scale-90 opacity-0" : ""}`}
      >
        <Avatar size={44} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-text-primary">Ask Sabicars</span>
          <span className="block text-xs text-text-muted">Replies instantly</span>
        </span>
      </button>

      {open && (
        <div
          id="ask-sabicars"
          role="dialog"
          aria-label="Ask Sabicars"
          className="ask-panel fixed inset-0 z-50 flex flex-col bg-surface-0 sm:inset-auto sm:right-4 sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:h-[min(44rem,calc(100dvh-10.5rem))] sm:w-[26.5rem] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/[0.09] sm:bg-surface-1 sm:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)] xl:right-6 xl:bottom-6 xl:h-[min(46rem,calc(100dvh-8rem))]"
        >
          <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">Ask Sabicars</p>
              {/* One line, so the chat doesn't jump when the new-chat button appears beside it on a phone */}
              <p className="flex items-center gap-1.5 text-xs whitespace-nowrap text-text-muted">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" /> AI · knows every car in stock
              </p>
            </div>
            {msgs.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex size-10 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
                aria-label="Start a new chat"
                title="New chat"
              >
                <RotateCcw aria-hidden size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcher.current?.focus();
              }}
              className="inline-flex size-10 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
              aria-label="Close"
            >
              <X aria-hidden size={20} />
            </button>
          </header>

          <div
            ref={log}
            onScroll={(e) => {
              // Only the reader scrolls up — following the reply always scrolls down — so upward movement means "let me reread".
              const el = e.currentTarget;
              if (el.scrollTop < lastTop.current - 4) stick.current = false;
              else if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) stick.current = true;
              lastTop.current = el.scrollTop;
            }}
            onClick={(e) => {
              // On a phone the chat covers the page: following a link should show the page.
              const a = (e.target as HTMLElement).closest("a");
              if (a?.getAttribute("href")?.startsWith("/") && window.matchMedia("(max-width: 639px)").matches) setOpen(false);
            }}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-5"
            aria-live="polite"
          >
            <div className="grid gap-5 text-[0.97rem] leading-relaxed text-text-secondary">
              <div className="grid gap-3">
                <p>
                  Hi — I’m Sabicars’ assistant. Tell me what you’re looking for and I’ll show you what’s in the showroom right now: a family
                  SUV, a Hummer bus for business, something within your budget, or two cars side by side.
                </p>
                {msgs.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-left text-sm text-text-primary transition-colors hover:border-gold-500/45 hover:bg-gold-500/[0.06]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msgs.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md border border-gold-500/25 bg-gold-500/[0.12] px-4 py-2.5 whitespace-pre-line text-text-primary">
                      {m.parts[0]?.kind === "text" ? m.parts[0].text : ""}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="grid gap-3">
                    {m.parts.map((p, i) =>
                      p.kind === "text" ? (
                        p.text.trim() ? (
                          <MessageText key={i} text={p.text} />
                        ) : null
                      ) : p.kind === "cars" ? (
                        <CarCards key={i} cars={p.cars} />
                      ) : p.kind === "compare" ? (
                        <CompareCard key={i} cars={p.cars} href={p.href} />
                      ) : p.kind === "race" ? (
                        <ChatRace key={i} race={p.race} />
                      ) : (
                        <CallbackForm key={i} conversationId={conversationId} path={pathname} />
                      ),
                    )}
                  </div>
                ),
              )}

              {waiting && (
                <span className="flex gap-1.5 py-2" role="status" aria-label="Ask Sabicars is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="ask-dot size-2 rounded-full bg-gold-400" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm text-text-primary">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-white/[0.07] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2 rounded-2xl border border-border-default bg-surface-2/70 p-1.5 pl-4 focus-within:border-gold-500/70"
            >
              <textarea
                ref={field}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={1500}
                placeholder="Ask about any car or budget…"
                aria-label="Your message"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[1.0625rem] text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] text-[#0A0908] transition-opacity disabled:opacity-35"
              >
                <ArrowUp aria-hidden size={20} strokeWidth={2.4} />
              </button>
            </form>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-text-muted">
              <span>Prefer a person?</span>
              <span className="flex items-center gap-3">
                <a href={`tel:${site.phones[0].e164}`} className="inline-flex min-h-8 items-center gap-1 hover:text-text-primary">
                  <Phone aria-hidden size={13} /> Call
                </a>
                <a
                  href={whatsappLink("Hello Sabicars")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 hover:text-text-primary"
                >
                  <MessageCircle aria-hidden size={13} /> WhatsApp
                </a>
                <button type="button" onClick={offerCallback} className="inline-flex min-h-8 items-center gap-1 hover:text-text-primary">
                  <PhoneCall aria-hidden size={13} /> Call me back
                </button>
              </span>
            </div>
            <p className="mt-1.5 px-1 text-[0.7rem] leading-snug text-text-muted">
              AI can make mistakes; stock and prices are live, and the team confirms every detail. Never share your BVN or card details in a
              chat.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
