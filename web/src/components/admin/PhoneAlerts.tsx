"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestAlert, setMyAlerts } from "@/lib/actions/leads-admin";

type State = "checking" | "unsupported" | "install" | "blocked" | "off" | "on";

const SW = "/staff-sw.js";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/admin/")) ?? navigator.serviceWorker.register(SW, { scope: "/admin/" });
}

/**
 * Alerts on this phone: the switch that puts every new enquiry in a staff
 * member's pocket the moment it is sent. On an iPhone, web push only works
 * from the home-screen app, so that is what it asks for first.
 */
export function PhoneAlerts({
  publicKey,
  receivesAlerts,
  waiting,
}: {
  publicKey: string | null;
  receivesAlerts: boolean;
  waiting: number;
}) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const nav = navigator as Navigator & {
      standalone?: boolean;
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    // The count on the home-screen icon matches the inbox.
    if (waiting > 0) nav.setAppBadge?.(waiting).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});

    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let cancelled = false;
    (async () => {
      let next: State;
      if (!supported) next = ios && !installed ? "install" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        // Re-save on every visit: it keeps the address fresh and tied to whoever is signed in.
        if (sub) await savePushSubscription(sub.toJSON(), navigator.userAgent);
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [waiting]);

  const turnOn = () =>
    start(async () => {
      setMessage(null);
      if (!publicKey) return setMessage({ tone: "bad", text: "Phone alerts are not set up on the server yet." });
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      try {
        const reg = await registration();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
        const saved = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!saved.ok) return setMessage({ tone: "bad", text: saved.error ?? "Could not save this phone." });
        setState("on");
        const test = await sendTestAlert();
        setMessage(
          test.ok
            ? { tone: "ok", text: "Done — a test alert is on its way to this phone." }
            : { tone: "bad", text: test.error ?? "The test alert did not arrive." },
        );
      } catch {
        setMessage({ tone: "bad", text: "This browser refused to set up alerts. Try again, or use Chrome." });
      }
    });

  const turnOff = () =>
    start(async () => {
      setMessage(null);
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const test = () =>
    start(async () => {
      const r = await sendTestAlert();
      setMessage(
        r.ok ? { tone: "ok", text: "Sent. It should appear in a few seconds." } : { tone: "bad", text: r.error ?? "It did not send." },
      );
    });

  const toggleAll = (on: boolean) => start(async () => void (await setMyAlerts(on)));

  const Icon = state === "on" ? BellRing : state === "blocked" || state === "unsupported" ? BellOff : Bell;
  const link = "min-h-10 text-sm font-semibold text-accent-text hover:text-text-primary disabled:opacity-50";

  return (
    <section
      aria-label="Alerts on this phone"
      className={`border bg-surface-1 p-4 md:p-5 ${state === "on" ? "border-border-subtle" : "border-gold-700"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon aria-hidden size={20} className={`mt-0.5 shrink-0 ${state === "on" ? "text-success" : "text-accent-text"}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {state === "on"
                ? "Alerts are on for this phone"
                : state === "checking"
                  ? "Checking this phone…"
                  : "Get every new enquiry on this phone"}
            </p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {state === "on" && "New enquiries arrive here the moment they are sent — even with the site closed."}
              {state === "off" && "Turn alerts on and a buyer's enquiry reaches you in seconds, not when someone next checks."}
              {state === "install" &&
                "On iPhone: tap Share, then “Add to Home Screen”. Open Sabicars Staff from your home screen and turn alerts on there."}
              {state === "blocked" && "Notifications are blocked for this site. Allow them in your browser's site settings, then reload."}
              {state === "unsupported" && "This browser cannot receive alerts. Use Chrome on Android, or the home-screen app on iPhone."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {state === "off" && (
            <button
              type="button"
              onClick={turnOn}
              disabled={pending}
              className="min-h-11 bg-cta px-5 text-sm font-semibold text-cta-fg hover:bg-cta-hover disabled:opacity-50"
            >
              {pending ? "Setting up…" : "Turn on alerts"}
            </button>
          )}
          {state === "on" && (
            <>
              <button type="button" onClick={test} disabled={pending} className={link}>
                Send a test
              </button>
              <button
                type="button"
                onClick={turnOff}
                disabled={pending}
                className="min-h-10 text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      {state === "on" && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-border-subtle pt-4 text-sm">
          <input
            type="checkbox"
            defaultChecked={receivesAlerts}
            onChange={(e) => toggleAll(e.target.checked)}
            className="mt-1 size-4 accent-[var(--gold-500)]"
          />
          <span>
            <span className="text-text-primary">Alert me about every new enquiry</span>
            <span className="block text-text-muted">
              Off: you are only alerted about enquiries given to you. Managers are always told when one waits 15 minutes.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}
