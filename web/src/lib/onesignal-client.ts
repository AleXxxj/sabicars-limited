"use client";

/**
 * Phone alerts for customers, through the OneSignal account the old site
 * already uses — so everyone who subscribed there keeps receiving them.
 *
 * The SDK is loaded only when it is needed: when a visitor asks for alerts,
 * or quietly after the page has settled for someone already subscribed (to
 * keep their subscription current). It never delays the first paint.
 */

interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: { permission: boolean; isPushSupported(): boolean; requestPermission(): Promise<void> };
  User: { PushSubscription: { optedIn?: boolean; optIn(): Promise<void> } };
}

declare global {
  interface Window {
    OneSignalDeferred?: ((os: OneSignalApi) => void | Promise<void>)[];
  }
}

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
let loading: Promise<OneSignalApi | null> | null = null;

export const alertsAvailable = () =>
  Boolean(APP_ID) && typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

/** Whether this browser has already said yes to alerts from this site. */
export const alertsGranted = () => alertsAvailable() && Notification.permission === "granted";
export const alertsBlocked = () => alertsAvailable() && Notification.permission === "denied";

export function loadOneSignal(): Promise<OneSignalApi | null> {
  if (!alertsAvailable()) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (os) => {
      try {
        await os.init({
          appId: APP_ID,
          // The same worker file, at the same address, as the old site: existing subscriptions carry on.
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          allowLocalhostAsSecureOrigin: true,
          // Sabicars asks in its own words, from the bell and one prompt; no floating OneSignal button.
          notifyButton: { enable: false },
        });
        resolve(os);
      } catch (e) {
        console.warn("[alerts] OneSignal could not start", e);
        resolve(null);
      }
    });
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loading;
}

/** Asks the browser for permission and subscribes. Resolves to whether alerts are now on. */
export async function turnOnAlerts(): Promise<boolean> {
  const os = await loadOneSignal();
  if (!os) return false;
  try {
    await os.Notifications.requestPermission();
    if (os.Notifications.permission && os.User.PushSubscription.optedIn === false) await os.User.PushSubscription.optIn();
    return os.Notifications.permission;
  } catch {
    return false;
  }
}
