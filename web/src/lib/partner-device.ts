/**
 * The partner page this phone last opened, kept on the phone itself, so the
 * header shows Account instead of Log in and goes straight to that page.
 * Nothing is sent anywhere: it lives in this browser only, and "Log out on
 * this phone" removes it. Every read and write is guarded, because storage can
 * be blocked (private windows, some in-app browsers).
 *
 * <html data-partner> mirrors it for CSS: app/layout.tsx sets it before the
 * first paint, and remember/forget keep it in step without a reload.
 */
export interface RememberedPartner {
  token: string;
  firstName: string;
}

const KEY = "sc_partner_page";
/** The key used for a few hours on 2026-11-06, read once and moved. Not the referral cookie of the same name. */
const OLD_KEY = "sc_partner";
const TOKEN = /^[0-9a-f-]{36}$/i;
const EVENT = "sc-partner-device";

/** The pre-paint check app/layout.tsx runs, as one line of script: a remembered page marks <html data-partner>. */
export const PARTNER_DEVICE_SCRIPT = `try{var v=localStorage.getItem(${JSON.stringify(KEY)})||localStorage.getItem(${JSON.stringify(OLD_KEY)});if(v&&/"token":"[0-9a-f-]{36}"/i.test(v))document.documentElement.setAttribute("data-partner","")}catch(e){}`;

function mark(on: boolean) {
  if (on) document.documentElement.setAttribute("data-partner", "");
  else document.documentElement.removeAttribute("data-partner");
}

export function rememberPartner(p: RememberedPartner): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.removeItem(OLD_KEY);
    mark(true);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* Storage blocked: the email link still works. */
  }
}

export function forgetPartner(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* Nothing stored. */
  }
  mark(false);
  window.dispatchEvent(new Event(EVENT));
}

/** The raw stored string, for useSyncExternalStore (a stable value between changes). */
export function rememberedRaw(): string | null {
  try {
    return localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
  } catch {
    return null;
  }
}

export function parseRemembered(raw: string | null): RememberedPartner | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RememberedPartner>;
    return typeof v.token === "string" && TOKEN.test(v.token) && typeof v.firstName === "string" ? { token: v.token, firstName: v.firstName } : null;
  } catch {
    return null;
  }
}

export function subscribeRemembered(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The address of a remembered partner page. Always opened with a full page load, never a client-side
 * route change: the address carries the page's private key, and Analytics only skips it on a fresh load
 * (components/site/Analytics.tsx); a route change would report it to Google.
 */
export const partnerPageHref = (token: string) => `/partner/${token}`;
