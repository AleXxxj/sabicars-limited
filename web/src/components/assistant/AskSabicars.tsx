"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ArrowUp, MessageCircle, Phone, PhoneCall, RotateCcw, X } from "lucide-react";
import { PrivacyLink } from "@/components/forms/shared";
import { Mark } from "@/components/Logo";
import { ASK_EVENT, type AskRequest } from "@/lib/assistant/open";
import type { Part } from "@/lib/assistant/parts";
import { waitingLine } from "@/lib/assistant/seller";
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
  role: "user" | "assistant" | "staff";
  parts: Part[];
  /** The first name of the person on the team, on a staff message. */
  name?: string;
  /** The stream ended before the server said it was done: a dropped connection, not a short answer. */
  cutOff?: boolean;
}

type Mode = "assistant" | "seller";

const CONVERSATION_KEY = "sc_ask_conversation";
const MESSAGES_KEY = "sc_ask_messages";
const MODE_KEY = "sc_ask_mode";
const SEEN_KEY = "sc_ask_seen";
/** The car page a seller room was opened on, so a room is never reused for a different car. */
const ROOM_PATH_KEY = "sc_ask_room_path";

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
  // The doubt is invited, not avoided: a wary buyer who sees their own question offered relaxes a little before asking it.
  return [
    "A family SUV under ₦30 million",
    "How do I know these cars are real?",
    "How does the 40% Drive Plan work?",
    "Which Hummer buses are in stock?",
  ];
}

/** The mark on Night, ringed in green: the assistant wears the brand, not a stock chat bubble. */
function Avatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#1d2a1e,var(--surface-0)_70%)] shadow-[inset_0_0_0_1.5px_rgb(120_176_48/0.55),0_6px_18px_-6px_rgb(0_0_0/0.8)]"
      style={{ width: size, height: size }}
    >
      <Mark size={size * 0.62} />
    </span>
  );
}

/** What the server streams back for one of Sabi's replies. */
type StreamEvent = { type: string; text?: string; part?: Part; conversationId?: string; error?: string };

/** A reply from the team or from Sabi, as the room reports it. */
type RoomMessage = { id: string; role: "assistant" | "staff"; name: string | null; text: string; at: string };

/**
 * Ask Sabicars: the showroom's best salesperson, in a chat window, at 2am.
 *
 * It never opens by itself — a panel springing over the page on arrival is
 * the most disliked pattern on a dealer's site — and it is always in the same
 * corner for whoever wants it. It says plainly that it is an AI, and a person
 * is always one tap away.
 *
 * Opened as "Chat with seller", the same window is a room with the team in it:
 * a message goes to their phones, a person replies, and the window follows
 * the room. If nobody is free within the typical wait, it asks Sabi to answer,
 * so the buyer is never left in silence (lib/assistant/seller.ts).
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
  const [mode, setMode] = useState<Mode>(() => stored<Mode>(MODE_KEY, "assistant"));
  // Seller room: a message of ours waiting for a person, and whether one is in the room.
  const [awaiting, setAwaiting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(75);
  const [staffHere, setStaffHere] = useState<string | null>(null);

  // State for what renders (the callback form files against it); a ref for the request in flight.
  const [conversationId, setConversationId] = useState<string | null>(() => stored<string | null>(CONVERSATION_KEY, null));
  const conversation = useRef(conversationId);
  const modeRef = useRef(mode);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const stick = useRef(true);
  const lastTop = useRef(0);
  const busyRef = useRef(false);
  const awaitingRef = useRef(false);
  // The last reply time the room has shown us, and the ids shown, so nothing is shown twice.
  const seenAt = useRef<string | null>(stored<string | null>(SEEN_KEY, null));
  const seenIds = useRef(new Set<string>());
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => remember(MESSAGES_KEY, msgs.length ? msgs.slice(-60) : null), [msgs]);
  useEffect(() => {
    modeRef.current = mode;
    remember(MODE_KEY, mode === "assistant" ? null : mode);
  }, [mode]);
  useEffect(() => {
    awaitingRef.current = awaiting;
  }, [awaiting]);

  // Follow the reply as it streams in — unless the reader has scrolled up to reread.
  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open, awaiting]);

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

  const noteSeen = (at: string) => {
    if (!seenAt.current || at > seenAt.current) {
      seenAt.current = at;
      remember(SEEN_KEY, at);
    }
  };

  /** Streams one of Sabi's replies into the bubble `reply`. Returns true when the server said the reply was whole. */
  const streamInto = useCallback(
    async (reply: string, payload: Record<string, unknown>): Promise<boolean> => {
      const update = (fn: (parts: Part[]) => Part[]) => setMsgs((m) => m.map((x) => (x.id === reply ? { ...x, parts: fn(x.parts) } : x)));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, conversationId: conversation.current, path: pathname }),
      });
      if (res.status === 409 && payload.answer) {
        const body = await res.json().catch(() => null);
        if (body?.skip) {
          // A person answered first: Sabi stays quiet, and the bubble was never needed.
          setMsgs((m) => m.filter((x) => x.id !== reply));
          return true;
        }
        throw new Error(body?.error ?? "Ask Sabicars can’t answer right now — please call or WhatsApp us.");
      }
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Ask Sabicars can’t answer right now — please call or WhatsApp us.");
      }
      // Newline-delimited JSON. A read can end mid-line, so the unfinished tail waits for the next one.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let whole = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent & { at?: string; id?: string | null };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "saved" && event.at) {
            // The server's own time and id for the reply just shown: the room is bounded by its clock, never the phone's.
            if (event.id) seenIds.current.add(event.id);
            noteSeen(event.at);
          } else if (event.type === "id" && event.conversationId) {
            conversation.current = event.conversationId;
            setConversationId(event.conversationId);
            remember(CONVERSATION_KEY, event.conversationId);
          } else if (event.type === "text" && event.text) {
            const chunk = event.text;
            update((parts) => {
              const last = parts.at(-1);
              return last?.kind === "text" ? [...parts.slice(0, -1), { kind: "text", text: last.text + chunk }] : [...parts, { kind: "text", text: chunk }];
            });
          } else if (event.type === "part" && event.part) {
            const part = event.part;
            update((parts) => [...parts, part]);
          } else if (event.type === "done") {
            whole = true;
          } else if (event.type === "error") {
            whole = true;
            setError(event.error ?? "Something went wrong.");
          }
        }
      }
      return whole;
    },
    [pathname],
  );

  /** In a seller room, the wait is over and nobody came: Sabi answers the waiting message. */
  const askSabi = useCallback(async () => {
    if (!awaitingRef.current || busyRef.current || !conversation.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const reply = uid();
    stick.current = true;
    setMsgs((m) => [...m, { id: reply, role: "assistant", parts: [] }]);
    try {
      const whole = await streamInto(reply, { answer: true });
      if (!whole) setMsgs((m) => m.map((x) => (x.id === reply ? { ...x, cutOff: true } : x)));
      setAwaiting(false);
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== reply || x.parts.length));
      setError(e instanceof Error ? e.message : "Ask Sabicars can’t answer right now.");
      // Still waiting: try once more in a little while rather than leave the room silent. The server decides if it may.
      if (awaitingRef.current) {
        if (waitTimer.current) clearTimeout(waitTimer.current);
        waitTimer.current = setTimeout(() => void askSabi(), 20_000);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    // askSabi refers to itself through the timer; the ref-based guards keep it safe.
  }, [streamInto]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busyRef.current) return;
      busyRef.current = true;
      stick.current = true;
      setError(null);
      setInput("");
      setBusy(true);

      if (modeRef.current === "seller") {
        // To the team first. The reply arrives through the room; Sabi only if nobody comes.
        setMsgs((m) => [...m, { id: uid(), role: "user", parts: [{ kind: "text", text: message }] }]);
        try {
          const res = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, conversationId: conversation.current, path: pathname, mode: "seller" }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) throw new Error(body?.error ?? "The chat can’t send right now — please call or WhatsApp us.");
          if (body?.conversationId) {
            conversation.current = body.conversationId;
            setConversationId(body.conversationId);
            remember(CONVERSATION_KEY, body.conversationId);
          }
          if (body?.at && !seenAt.current) noteSeen(body.at);
          const wait = typeof body?.waitSeconds === "number" ? body.waitSeconds : 75;
          setWaitSeconds(wait);
          setAwaiting(true);
          awaitingRef.current = true;
          if (waitTimer.current) clearTimeout(waitTimer.current);
          busyRef.current = false;
          setBusy(false);
          if (wait === 0) void askSabi();
          else waitTimer.current = setTimeout(() => void askSabi(), wait * 1000);
        } catch (e) {
          setError(e instanceof Error ? e.message : "The chat can’t send right now.");
          busyRef.current = false;
          setBusy(false);
        }
        return;
      }

      const reply = uid();
      setMsgs((m) => [
        ...m,
        { id: uid(), role: "user", parts: [{ kind: "text", text: message }] },
        { id: reply, role: "assistant", parts: [] },
      ]);
      try {
        const whole = await streamInto(reply, { message });
        // The server marks the end of every reply; a stream that closed without it was cut off on the way.
        if (!whole) setMsgs((m) => m.map((x) => (x.id === reply ? { ...x, cutOff: true } : x)));
      } catch (e) {
        // An empty reply bubble would look like being ignored: remove it.
        setMsgs((m) => m.filter((x) => x.id !== reply || x.parts.length));
        setError(e instanceof Error ? e.message : "Ask Sabicars can’t answer right now.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [pathname, streamInto, askSabi],
  );

  // The room: while a seller chat is open, fetch the team's replies every few seconds.
  useEffect(() => {
    if (!open || mode !== "seller" || !conversationId) return;
    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const q = seenAt.current ? `?after=${encodeURIComponent(seenAt.current)}` : "";
        const res = await fetch(`/api/assistant/${conversationId}/messages${q}`, { cache: "no-store" });
        if (res.status === 404) {
          // This browser is not keeping the chat's cookie: it can send, but never see a reply. Say so rather than wait in silence.
          if (waitTimer.current) clearTimeout(waitTimer.current);
          setAwaiting(false);
          awaitingRef.current = false;
          setError("Your browser is not keeping this chat, so replies cannot reach it here. Please call or WhatsApp us, or open the site in Safari or Chrome.");
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { messages: RoomMessage[]; awaiting: boolean; remainingSeconds?: number; staffPresent: boolean; waitSeconds: number };
        // A reloaded window finds its message still waiting: arm the timer again from what is left of the wait.
        if (body.awaiting && !awaitingRef.current && !busyRef.current) {
          setAwaiting(true);
          awaitingRef.current = true;
          setWaitSeconds(body.waitSeconds);
          if (waitTimer.current) clearTimeout(waitTimer.current);
          waitTimer.current = setTimeout(() => void askSabi(), Math.max(0, body.remainingSeconds ?? body.waitSeconds) * 1000);
        }
        const fresh = body.messages.filter((m) => !seenIds.current.has(m.id));
        for (const m of fresh) seenIds.current.add(m.id);
        if (fresh.length) {
          stick.current = true;
          setMsgs((prev) => [
            ...prev,
            ...fresh.map<Msg>((m) => ({ id: m.id, role: m.role, name: m.name ?? undefined, parts: [{ kind: "text", text: m.text }] })),
          ]);
          noteSeen(fresh[fresh.length - 1].at);
          const person = fresh.filter((m) => m.role === "staff").at(-1);
          if (person) {
            setStaffHere(person.name ?? "Sabicars team");
            // A person answered: Sabi is not needed.
            if (waitTimer.current) clearTimeout(waitTimer.current);
            setAwaiting(false);
            awaitingRef.current = false;
          }
        }
        if (!body.staffPresent) setStaffHere(null);
        if (!body.awaiting && awaitingRef.current && !busyRef.current) {
          // Answered elsewhere (another tab, or Sabi already): stop waiting.
          setAwaiting(false);
          awaitingRef.current = false;
        }
      } catch {
        /* A missed poll is nothing; the next one catches up. */
      }
    };
    void poll();
    const timer = setInterval(poll, awaiting ? 4_000 : 10_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [open, mode, conversationId, awaiting, askSabi]);

  useEffect(() => () => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
  }, []);

  /** Leaves the current conversation behind and starts the window afresh in `next` mode. */
  const startFresh = useCallback((next: Mode) => {
    setMsgs([]);
    setError(null);
    conversation.current = null;
    setConversationId(null);
    remember(CONVERSATION_KEY, null);
    seenAt.current = null;
    remember(SEEN_KEY, null);
    seenIds.current.clear();
    if (waitTimer.current) clearTimeout(waitTimer.current);
    setAwaiting(false);
    awaitingRef.current = false;
    setStaffHere(null);
    setMode(next);
    modeRef.current = next;
    remember(ROOM_PATH_KEY, null);
  }, []);

  // Other parts of the site open the chat — with a question already asked, or as a chat with the team.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<AskRequest>).detail;
      if (detail?.seller) {
        // A fresh room with the team in it — also when the last room was about another car, so the team is told the right one.
        const roomPath = stored<string | null>(ROOM_PATH_KEY, null);
        if (modeRef.current !== "seller" || roomPath !== pathname) {
          startFresh("seller");
          remember(ROOM_PATH_KEY, pathname);
        }
        setOpen(true);
        return;
      }
      // A question for Sabi: never sent into a room with the team.
      if (modeRef.current === "seller") startFresh("assistant");
      setOpen(true);
      if (detail?.prompt) void send(detail.prompt);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [send, startFresh, pathname]);

  // A link can carry a question: sabicars.com/?ask=Which+Hummer+buses+do+you+have
  useEffect(() => {
    const url = new URL(window.location.href);
    const prompt = url.searchParams.get("ask")?.trim().slice(0, 300);
    if (!prompt) return;
    url.searchParams.delete("ask");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const t = window.setTimeout(() => {
      if (modeRef.current === "seller") startFresh("assistant");
      setOpen(true);
      void send(prompt);
    }, 400);
    return () => window.clearTimeout(t);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    startFresh("assistant");
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

  const seller = mode === "seller";
  const suggestions = suggestionsFor(pathname);
  const last = msgs.at(-1);
  const waiting = busy && last?.role === "assistant" && !last.parts.length;
  const title = seller ? "Sabicars team" : "Ask Sabicars";
  const status = seller
    ? staffHere
      ? `${staffHere} is here`
      : awaiting
        ? "Sent to the team"
        : "A person joins when free · Sabi answers now"
    : "AI · knows every car in stock";

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="ask-sabicars"
        aria-label={open ? "Close Ask Sabicars" : "Ask Sabicars a question"}
        className={`ask-launcher group fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 rounded-full border border-green-500/35 bg-surface-1/90 p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8),0_0_0_6px_rgb(120_176_48/0.06)] backdrop-blur-md transition-[transform,opacity] duration-300 hover:border-green-400/60 sm:pr-5 lg:right-6 lg:bottom-6 ${open ? "pointer-events-none scale-90 opacity-0" : ""}`}
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
          aria-label={title}
          className="ask-panel fixed inset-0 z-50 flex flex-col bg-surface-0 sm:inset-auto sm:right-4 sm:bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:h-[min(44rem,calc(100dvh-10.5rem))] sm:w-[26.5rem] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/[0.09] sm:bg-surface-1 sm:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)] lg:right-6 lg:bottom-6 lg:h-[min(46rem,calc(100dvh-8rem))]"
        >
          <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">{title}</p>
              {/* One line, so the chat doesn't jump when the new-chat button appears beside it on a phone */}
              <p className="flex items-center gap-1.5 text-xs whitespace-nowrap text-text-muted">
                <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${seller && awaiting && !staffHere ? "bg-orange-400" : "bg-success"}`} /> {status}
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
                {seller ? (
                  <p>
                    You are chatting with the Sabicars team. Type your message. A person replies when free. If nobody is free in about a
                    minute, Sabi, our assistant, answers, and the team joins after.
                  </p>
                ) : (
                  <p>
                    Hi — I’m Sabicars’ assistant. Tell me what you’re looking for and I’ll show you what’s in the showroom right now: a family
                    SUV, a Hummer bus for business, something within your budget, or two cars side by side.
                  </p>
                )}
                {msgs.length === 0 && !seller && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-left text-sm text-text-primary transition-colors hover:border-green-500/45 hover:bg-green-500/[0.06]"
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
                    <p className="max-w-[85%] rounded-2xl rounded-br-md border border-green-500/25 bg-green-500/[0.12] px-4 py-2.5 whitespace-pre-line text-text-primary">
                      {m.parts[0]?.kind === "text" ? m.parts[0].text : ""}
                    </p>
                  </div>
                ) : m.role === "staff" ? (
                  <div key={m.id} className="grid gap-1.5">
                    <p className="text-[0.7rem] font-semibold tracking-wide text-orange-200 uppercase">{m.name ?? "Sabicars team"} · Sabicars team</p>
                    <p className="max-w-[92%] rounded-2xl rounded-bl-md border border-orange-400/30 bg-orange-500/[0.07] px-4 py-2.5 whitespace-pre-line text-text-primary">
                      {m.parts[0]?.kind === "text" ? m.parts[0].text : ""}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="grid gap-3">
                    {seller && m.parts.length > 0 && <p className="text-[0.7rem] font-semibold tracking-wide text-green-300 uppercase">Sabi · assistant</p>}
                    {m.parts.map((p, i) =>
                      p.kind === "text" ? (
                        p.text.trim() ? (
                          <MessageText key={i} text={p.text} streaming={busy && m.id === last?.id} />
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
                    {m.cutOff && !busy && (
                      <p role="status" className="text-sm text-text-muted">
                        {seller ? (
                          // The whole reply is saved on the server; the room fetches it on its next look.
                          "The reply was cut off on the way. The full one will appear in a moment."
                        ) : (
                          <>
                            The reply was cut off on the way — a weak connection, most likely.{" "}
                            <button
                              type="button"
                              onClick={() => {
                                const asked = msgs[msgs.findIndex((x) => x.id === m.id) - 1];
                                const text = asked?.parts[0]?.kind === "text" ? asked.parts[0].text : "";
                                if (text) send(text);
                              }}
                              className="font-semibold text-green-300 underline-offset-4 hover:underline"
                            >
                              Ask again
                            </button>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                ),
              )}

              {seller && awaiting && !busy && (
                <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
                  <span aria-hidden className="ask-dot size-2 rounded-full bg-orange-400" /> {waitingLine(waitSeconds)}
                </p>
              )}

              {waiting && (
                <span className="flex gap-1.5 py-2" role="status" aria-label="Sabi is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="ask-dot size-2 rounded-full bg-green-400" style={{ animationDelay: `${i * 160}ms` }} />
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
              className="flex items-end gap-2 rounded-2xl border border-border-default bg-surface-2/70 p-1.5 pl-4 focus-within:border-green-500/70"
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
                placeholder={seller ? "Write to the team…" : "Ask about any car or budget…"}
                aria-label="Your message"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[1.0625rem] text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,var(--orange-400),var(--orange-500))] text-[#090E0A] transition-opacity disabled:opacity-35"
              >
                <ArrowUp aria-hidden size={20} strokeWidth={2.4} />
              </button>
            </form>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs text-text-muted">
              <span>{seller ? "Rather talk?" : "Prefer a person?"}</span>
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
              {seller ? "Sabi, the assistant, is AI and can make mistakes; a person on the team confirms every detail. " : "AI can make mistakes; stock and prices are live, and the team confirms every detail. "}
              Never share your BVN or card details in a chat. Chats are kept so the team can follow up. <PrivacyLink />
            </p>
          </div>
        </div>
      )}
    </>
  );
}
