/** Where the visitor's theme choice is remembered. */
export const THEME_KEY = "sabicars-theme";

/**
 * Runs in <head> before the first paint, so a visitor who chose light never
 * sees a flash of dark on each page load. Storage can be unavailable (private
 * windows, blocked site data), hence the try.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
