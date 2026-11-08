/**
 * The app opening. Android shows a still picture (the icon on Night) until the site has painted;
 * it cannot animate that on most phones. So the site takes over the moment it paints: the same
 * mark in the same place, then it breathes, lifts, the wordmark arrives, a line draws, and the
 * page shows through (styles/intro.css, overlay in app/layout.tsx).
 *
 * Shown only when the site was opened as an app — the Play Store shell (document.referrer is
 * android-app://com.sabicars.app) or an installed PWA (display-mode: standalone) — once per app
 * session, never in the admin, never on the plain website. `?intro=1` forces it for a look.
 *
 * Runs before the first paint (Script beforeInteractive) so the overlay is there from the first
 * frame; it marks <html data-intro>, and the CSS does the rest. The attribute is removed after
 * the sequence, which hides the overlay; pointer-events are off throughout, so a failed timer
 * could never trap a buyer behind it.
 */
export const APP_INTRO_MS = 1700;

export const APP_INTRO_SCRIPT = `try{var d=document,h=d.documentElement,p=location.pathname;if(p.indexOf("/admin")!==0){var app=/^android-app:\\/\\/com\\.sabicars\\.app/.test(d.referrer)||matchMedia("(display-mode: standalone)").matches||navigator.standalone===true,force=/(?:\\?|&)intro=1(?:&|$)/.test(location.search);if(force||(app&&!sessionStorage.getItem("sabi_intro"))){h.setAttribute("data-intro","");sessionStorage.setItem("sabi_intro","1");setTimeout(function(){h.removeAttribute("data-intro")},${APP_INTRO_MS})}}}catch(e){}`;
