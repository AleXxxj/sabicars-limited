"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, X } from "lucide-react";
import { alertsAvailable, alertsBlocked, alertsGranted, loadOneSignal, turnOnAlerts } from "@/lib/onesignal-client";

interface FeedItem {
  id: string;
  title: string;
  message: string;
  kind: string;
  link: string | null;
  image: string | null;
  at: string;
}

const SEEN_KEY = "sabicars:bell-seen";
/** On a first visit, the last week counts as new. */
const FIRST_VISIT_WINDOW = 7 * 86_400_000;

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || Date.now() - FIRST_VISIT_WINDOW;
  } catch {
    return Date.now() - FIRST_VISIT_WINDOW;
  }
}

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/**
 * The bell: what is new at Sabicars — arrivals, price drops, offers — and the
 * switch that puts them on your phone. Posted by the platform itself, so it
 * is never stale for want of someone typing it.
 */
export function NotificationBell() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [seen, setSeen] = useState(0);
  const [alerts, setAlerts] = useState<"unavailable" | "off" | "on" | "blocked" | "working" | "failed">("unavailable");
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setItems(((await res.json()) as { items: FeedItem[] }).items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Browser-only facts, read once the page is interactive (the server cannot know them).
    const now = window.setTimeout(() => {
      setSeen(readSeen());
      setAlerts(!alertsAvailable() ? "unavailable" : alertsBlocked() ? "blocked" : alertsGranted() ? "on" : "off");
    }, 0);
    // After the page has drawn: the feed, and — for someone already subscribed — the SDK, to keep them current.
    const later = window.setTimeout(() => {
      void load();
      if (alertsGranted()) void loadOneSignal();
    }, 1500);
    return () => {
      window.clearTimeout(now);
      window.clearTimeout(later);
    };
  }, [load]);

  const unread = items?.filter((i) => new Date(i.at).getTime() > seen).length ?? 0;

  const open = () => {
    if (!items) void load();
    dialog.current?.showModal();
    const now = Date.now();
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {}
    // Keep the "new" dots while the panel is open; the count clears.
    window.setTimeout(() => setSeen(now), 60_000);
  };
  const close = () => {
    dialog.current?.close();
    setSeen(Date.now());
  };

  const enable = async () => {
    setAlerts("working");
    setAlerts((await turnOnAlerts()) ? "on" : alertsBlocked() ? "blocked" : "failed");
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={unread ? `What's new — ${unread} new` : "What's new"}
        className="glass relative inline-flex size-10 items-center justify-center rounded-full text-text-primary transition-colors hover:text-gold-300 sm:size-11"
      >
        <Bell aria-hidden size={19} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="figures absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[0.68rem] leading-5 font-bold text-[#0A0908]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        onClose={() => setSeen(Date.now())}
        aria-label="What's new at Sabicars"
        className="m-0 mt-auto max-h-[88svh] w-full max-w-none overflow-hidden rounded-t-3xl border border-white/10 bg-surface-1 p-0 text-text-primary shadow-[0_-30px_80px_-20px_rgb(0_0_0/0.8)] backdrop:bg-[#0A0908]/60 backdrop:backdrop-blur-[2px] open:flex open:flex-col open:animate-[prompt-in_var(--duration-base)_var(--ease-out)] sm:mt-20 sm:mr-6 sm:mb-auto sm:ml-auto sm:max-h-[min(40rem,calc(100svh-7rem))] sm:w-[26rem] sm:rounded-3xl xl:mr-[max(1.5rem,calc((100vw-80rem)/2+2.5rem))]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <p className="font-display text-[1.5rem] leading-tight">What&rsquo;s new</p>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex size-10 items-center justify-center rounded-full text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
          >
            <X aria-hidden size={19} />
          </button>
        </div>

        {alerts !== "unavailable" && (
          <div className="border-b border-white/[0.06] bg-surface-2/60 px-5 py-3.5 text-sm">
            {alerts === "on" ? (
              <p className="flex items-center gap-2 text-text-secondary">
                <BellRing aria-hidden size={16} className="text-gold-300" /> Alerts are on for this phone.
              </p>
            ) : alerts === "blocked" ? (
              <p className="text-text-secondary">
                Alerts are blocked for this site. Allow notifications in your browser settings to get them.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-text-secondary">
                  {alerts === "failed" ? "That did not work — try again?" : "Get new arrivals and price drops on your phone."}
                </p>
                <button
                  type="button"
                  onClick={enable}
                  disabled={alerts === "working"}
                  className="shrink-0 rounded-full bg-gold-400 px-4 py-2 text-[0.85rem] font-semibold text-[#0A0908] hover:bg-gold-300 disabled:opacity-60"
                >
                  {alerts === "working" ? "One moment…" : "Turn on"}
                </button>
              </div>
            )}
          </div>
        )}

        <ul className="flex-1 divide-y divide-white/[0.05] overflow-y-auto overscroll-contain">
          {items === null ? (
            <li className="px-5 py-10 text-center text-sm text-text-muted">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-text-muted">
              Nothing yet. New arrivals appear here the moment they are listed.
            </li>
          ) : (
            items.map((i) => {
              const fresh = new Date(i.at).getTime() > seen;
              const body = (
                <>
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small, already-sized Cloudinary thumbnails
                    <img src={i.image} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-gold-300">
                      <Bell size={20} strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="line-clamp-2 text-[0.95rem] leading-snug font-semibold text-text-primary">{i.title}</span>
                      {fresh && <span aria-label="New" className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-400" />}
                    </span>
                    {i.message && <span className="mt-1 line-clamp-2 block text-sm leading-snug text-text-secondary">{i.message}</span>}
                    <span className="mt-1.5 block text-xs text-text-muted">{ago(i.at)}</span>
                  </span>
                </>
              );
              return (
                <li key={i.id}>
                  {i.link ? (
                    <Link href={i.link} onClick={close} className="flex gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-4 px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </dialog>
    </>
  );
}
