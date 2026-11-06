/**
 * "A partner is logged in on this phone", for the header. The session itself
 * is an httpOnly cookie no script can read (lib/partner-session.ts); beside it
 * the server sets a readable flag, sc_signed_in=1, that says only that.
 * app/layout.tsx runs PARTNER_FLAG_SCRIPT before the first paint to mark
 * <html data-partner>, and globals.css then shows Account instead of Log in,
 * on pages that are otherwise the same for everyone.
 *
 * The flag can outlive the session (a reset elsewhere, a session that ran
 * out). The log-in page clears it when the server says nobody is logged in.
 */
const FLAG = "sc_signed_in";

/** Before the first paint: mark <html data-partner>, and clear what the stored-link log-in of 6 November left behind. */
export const PARTNER_FLAG_SCRIPT = `try{if(/(?:^|; )${FLAG}=1(?:;|$)/.test(document.cookie))document.documentElement.setAttribute("data-partner","");localStorage.removeItem("sc_partner_page");localStorage.removeItem("sc_partner")}catch(e){}`;

/** After a log-in without a full page load, the header must show Account at once. */
export function markSignedIn(): void {
  document.documentElement.setAttribute("data-partner", "");
}

/** The server says nobody is logged in here: a flag left behind must not keep showing Account. */
export function clearStaleSignedIn(): void {
  if (!new RegExp(`(?:^|; )${FLAG}=1(?:;|$)`).test(document.cookie)) return;
  document.cookie = `${FLAG}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.documentElement.removeAttribute("data-partner");
}
