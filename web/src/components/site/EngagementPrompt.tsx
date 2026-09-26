"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Mail, Share, Smartphone, Star, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ReviewForm, REVIEWED_KEY } from "@/components/reviews/ReviewForm";
import { SubscribeForm, SUBSCRIBED_KEY } from "@/components/subscribe/SubscribeForm";
import { alertsAvailable, turnOnAlerts } from "@/lib/onesignal-client";

type Kind = "subscribe" | "alerts" | "install" | "review";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DAY = 86_400_000;
/** How long "Not now" is respected before the same ask is made again. */
const REST: Record<Kind, number> = { subscribe: 14 * DAY, alerts: 14 * DAY, install: 30 * DAY, review: 60 * DAY };
/** Seconds on the site, and a second page or some reading, before anything is asked. */
const ENGAGED_AFTER_MS = 25_000;
const QUIET_PATHS = ["/review/", "/unsubscribe/"];

const store = {
  get(key: string, session = false): string | null {
    try {
      return (session ? sessionStorage : localStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string, session = false) {
    try {
      (session ? sessionStorage : localStorage).setItem(key, value);
    } catch {}
  },
};

const resting = (kind: Kind) => {
  const at = Number(store.get(`sabicars:prompt:${kind}`));
  return Boolean(at) && Date.now() - at < REST[kind];
};
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * One ask per visit, and only once the visitor is clearly interested.
 *
 * The old site could stack four popups on one visit — newsletter, review,
 * push, install. Here there is at most one, in this order of value:
 * subscribe, phone alerts, add to home screen, and — for someone who keeps
 * coming back — a review. Each is skipped once done, and rests after "Not now".
 */
export function EngagementPrompt() {
  const pathname = usePathname();
  const [kind, setKind] = useState<Kind | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Count page views and visits for the session.
  useEffect(() => {
    if (!store.get("sabicars:session-start", true)) {
      store.set("sabicars:session-start", String(Date.now()), true);
      store.set("sabicars:visits", String(Number(store.get("sabicars:visits") ?? 0) + 1));
    }
    store.set("sabicars:views", String(Number(store.get("sabicars:views", true) ?? 0) + 1), true);
  }, [pathname]);

  // Android offers its own "install" dialog; keep it for the right moment.
  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);

  useEffect(() => {
    if (kind || store.get("sabicars:prompted", true) || QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    let deepest = 0;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) deepest = Math.max(deepest, window.scrollY / max);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const choose = (): Kind | null => {
      if (!store.get(SUBSCRIBED_KEY) && !resting("subscribe")) return "subscribe";
      if (alertsAvailable() && Notification.permission === "default" && !resting("alerts")) return "alerts";
      if (!standalone() && (installEvent || ios()) && !resting("install")) return "install";
      if (Number(store.get("sabicars:visits")) >= 3 && !store.get(REVIEWED_KEY) && !resting("review")) return "review";
      return null;
    };

    const timer = window.setInterval(() => {
      const started = Number(store.get("sabicars:session-start", true)) || Date.now();
      const views = Number(store.get("sabicars:views", true)) || 1;
      if (Date.now() - started < ENGAGED_AFTER_MS || (views < 2 && deepest < 0.4)) return;
      window.clearInterval(timer);
      const next = choose();
      if (next) {
        store.set("sabicars:prompted", "1", true);
        setKind(next);
      }
    }, 2000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, kind, installEvent]);

  if (!kind) return null;

  const notNow = () => {
    store.set(`sabicars:prompt:${kind}`, String(Date.now()));
    setKind(null);
  };
  const finish = () => setKind(null);

  const content: Record<Kind, { icon: typeof Mail; title: string; body: string }> = {
    subscribe: {
      icon: Mail,
      title: "New arrivals, every Friday",
      body: "The week’s new cars in your inbox — photographed, priced, and before they are gone.",
    },
    alerts: {
      icon: BellRing,
      title: "Know the moment a car lands",
      body: "Get new arrivals and price drops as alerts on this phone. Turn them off any time.",
    },
    install: {
      icon: Smartphone,
      title: "Keep Sabicars on your home screen",
      body: installEvent
        ? "The showroom in one tap: new arrivals, your saved cars and the Drive Plan."
        : "Tap Share, then “Add to Home Screen” — the showroom in one tap.",
    },
    review: { icon: Star, title: "Bought from Sabicars?", body: "Tell the next buyer how it went. It takes a minute." },
  };
  const { icon: Icon, title, body } = content[kind];

  return (
    <>
      <aside
        data-prompt
        aria-label={title}
        className="surface-card fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 !rounded-2xl p-5 sm:inset-x-auto sm:left-5 sm:w-[24rem] xl:bottom-5"
      >
        <button
          type="button"
          onClick={notNow}
          aria-label="Not now"
          className="absolute top-2.5 right-2.5 inline-flex size-10 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
        >
          <X aria-hidden size={18} />
        </button>
        <div className="flex gap-4 pr-8">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300">
            <Icon size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {body}
              {kind === "install" && !installEvent && (
                <Share aria-label="Share" size={15} className="ml-1 inline align-[-2px] text-gold-300" />
              )}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {kind === "subscribe" && <SubscribeForm source="prompt" onDone={() => window.setTimeout(finish, 3500)} />}
          {kind === "alerts" && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await turnOnAlerts();
                  setBusy(false);
                  finish();
                }}
              >
                {busy ? "One moment…" : "Turn on alerts"}
              </Button>
              <Button type="button" variant="quiet" onClick={notNow}>
                Not now
              </Button>
            </div>
          )}
          {kind === "install" && installEvent && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={async () => {
                  await installEvent.prompt();
                  const { outcome } = await installEvent.userChoice;
                  setInstallEvent(null);
                  if (outcome === "dismissed") notNow();
                  else finish();
                }}
              >
                Add to home screen
              </Button>
              <Button type="button" variant="quiet" onClick={notNow}>
                Not now
              </Button>
            </div>
          )}
          {kind === "review" && (
            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => setReviewOpen(true)}>
                Write a review
              </Button>
              <Button type="button" variant="quiet" onClick={notNow}>
                Not now
              </Button>
            </div>
          )}
        </div>
      </aside>

      {kind === "review" && (
        <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} title="Write a review">
          <ReviewForm
            onDone={() => {
              setReviewOpen(false);
              finish();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
