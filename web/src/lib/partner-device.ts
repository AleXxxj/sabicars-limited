/**
 * The partner page this phone last opened, kept on the phone itself, so the
 * header's Log in takes a partner straight back to their page next time.
 * Nothing is sent anywhere: it lives in this browser only, and "Log out on
 * this phone" removes it. Every read and write is guarded, because storage can
 * be blocked (private windows, some in-app browsers).
 */
export interface RememberedPartner {
  token: string;
  firstName: string;
}

const KEY = "sc_partner";
const TOKEN = /^[0-9a-f-]{36}$/i;
const EVENT = "sc-partner-device";

export function rememberPartner(p: RememberedPartner): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* Storage blocked: the email link still works. */
  }
}

export function forgetPartner(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* Nothing stored. */
  }
}

/** The raw stored string, for useSyncExternalStore (a stable value between changes). */
export function rememberedRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
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
