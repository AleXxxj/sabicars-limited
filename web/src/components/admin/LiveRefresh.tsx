"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps an open inbox current without anyone pressing reload: it refreshes
 * the moment an alert arrives on this phone, when the app comes back to the
 * foreground, and on a timer while it is on screen — once a minute for an
 * inbox, every few seconds for a live chat.
 */
export function LiveRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const onAlert = (e: MessageEvent) => e.data?.type === "lead-alert" && router.refresh();
    navigator.serviceWorker?.addEventListener("message", onAlert);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, everyMs);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onAlert);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, [router, everyMs]);
  return null;
}
