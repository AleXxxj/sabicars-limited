"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { ENQUIRED_EVENT } from "./enquired";
import { SHEET_EVENT } from "./EnquirySheet";

/** Why the bar is out of sight: the page's own buttons are in view, or the page has reached other cars. */
type Away = "row" | "similar" | null;

/**
 * Once the bar has slid away it comes back only when what sent it away is this far past the edge again, and
 * once back it goes only when the edge is crossed outright: a scroll that wobbles on the line never sends it
 * back and forth.
 */
const SETTLE_PX = 24;

/** Up to this far down the page counts as the top, where the first screen is measured against the viewport. */
const TOP_PX = 8;

/** The photo's bottom edge stops this far above the bar. */
const GAP_PX = 10;

/**
 * The bar's top edge in the viewport. From the bar itself when it is in the document: the window's height less
 * its offset from the bottom (the tab bar and the home indicator) and its own height — transforms do not change
 * offsetHeight, so this holds while the bar is slid away. On the first render of a client-side navigation the
 * bar is not in the document yet, so its place is read off the tab bar instead: the bar's bottom edge sits on
 * the tab bar's content, just under its 1px border, and its height is its classes (py-2.5, min-h-12, a 1px
 * border: 4.25rem + 1px).
 */
function barTop(bar: HTMLElement | null, tab: HTMLElement) {
  if (bar) return window.innerHeight - parseFloat(getComputedStyle(bar).bottom) - bar.offsetHeight;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return tab.getBoundingClientRect().top + 1 - (4.25 * rem + 1);
}

let last: Away = null;

/**
 * What stands in the bar's way right now. The three buttons under the photo count from the moment any of them
 * would show above the bar until all of them have gone over the sticky header — the bar never doubles them —
 * so the bar is up on arrival, where the page's first screen keeps the buttons beneath it, slides away as they
 * come out from under it, and is back the moment they have gone, call-back line or not. "Similar vehicles"
 * counts from the moment its top edge comes into view, and from there on the page is about other cars, so the
 * bar stays away. Nothing on a laptop, where there is no tab bar.
 */
function read(): Away {
  const tab = document.querySelector<HTMLElement>('nav[aria-label="Quick"]');
  if (!tab || !tab.offsetHeight) return (last = null);
  const top = barTop(document.querySelector<HTMLElement>("[data-ask-dock]"), tab);
  const similar = document.getElementById("similar")?.getBoundingClientRect();
  if (similar && similar.top < (last === "similar" ? top + SETTLE_PX : top)) return (last = "similar");
  const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const buttons = document.querySelector("#primary-actions [data-buttons]")?.getBoundingClientRect();
  if (buttons) {
    const inView =
      last === "row"
        ? buttons.top < top + SETTLE_PX && buttons.bottom > header // back only once fully under the bar, or gone
        : buttons.top < top && buttons.bottom > header + SETTLE_PX; // away the moment one would show above the bar
    if (inView) return (last = "row");
  }
  return (last = null);
}

/** Scroll and resize, read once per frame. */
function subscribe(onChange: () => void) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    cancelAnimationFrame(frame);
  };
}

const never = () => () => {};
const away = () => null;
const yes = () => true;
const no = () => false;

/**
 * The first screen's height, measured against the viewport as it is now: from the top of the first-screen box
 * (the Gallery's; name, facts, price and the photo) down to GAP_PX above the bar. The car's page sets the same
 * sum in CSS from the small viewport for the first paint; this takes over because Safari on iOS keeps its
 * toolbar minimised after a navigation from a scrolled list, and the viewport is then taller than the small
 * viewport, which would leave the bar hanging below the photo with the buttons showing in between.
 */
function fitFirstScreen(bar: HTMLElement) {
  const box = document.getElementById("first-screen");
  if (!box || getComputedStyle(box).display === "contents") return;
  const bars = parseFloat(getComputedStyle(bar).bottom) + bar.offsetHeight;
  const top = box.getBoundingClientRect().top + window.scrollY;
  document.documentElement.style.setProperty("--car-first-screen", `${window.innerHeight - bars - GAP_PX - top}px`);
}

/*
 * The same two readings, run by the browser as the page is parsed, before React is on the page, so the first
 * paint is right: the first screen is fitted to the viewport (above), and where the browser brings the page back
 * scrolled (a restored scroll position, the back button) with the buttons in view, <html> is marked and a rule in
 * globals.css keeps the bar away until this component is ready and reads for itself. On a client-side navigation
 * React does not run inline scripts, and the layout effect below does both instead. The bar, the box and the
 * buttons are all parsed by this point: the bar is rendered right after the gallery.
 */
const FIRST_PAINT =
  '(function(){var b=document.querySelector("[data-ask-dock]"),x=document.getElementById("first-screen"),r=document.querySelector("#primary-actions [data-buttons]"),h=document.querySelector("header");' +
  'if(!b)return;var s=getComputedStyle(b);if(s.display==="none")return;var e=innerHeight-parseFloat(s.bottom),t=e-b.offsetHeight;' +
  `if(x&&getComputedStyle(x).display!=="contents")document.documentElement.style.setProperty("--car-first-screen",(t-${GAP_PX}-(x.getBoundingClientRect().top+scrollY))+"px");` +
  'if(!r)return;var y=r.getBoundingClientRect(),k=h?h.getBoundingClientRect().bottom:0;if(y.top<t&&y.bottom>k)document.documentElement.setAttribute("data-car-row","on-screen")})();';

/**
 * The phone bar on a car's page: Call, a chat with the team, and a written question (the enquiry sheet,
 * opened on "Ask a question"). Nothing else: no name, no price, the page has those. It is up on arrival, with
 * the three buttons under the photo beneath it; it slides down behind the tab bar as those buttons come out
 * from under it, so the two never double up, and slides back the moment they have gone. It goes for good once
 * "Similar vehicles" comes into view, and steps aside while the enquiry sheet is open. Solid, not glass: an
 * orange button scrolling under a see-through bar lit the whole bar orange, which read as a broken page. Once
 * an enquiry is saved, "Enquire" becomes the reference.
 *
 * It also keeps the page's first screen fitted to the viewport (fitFirstScreen): on arrival, and again on a
 * resize while the page is at the top — Safari's toolbar coming and going — but never while scrolled, so
 * nothing under the buyer's thumb moves. A width change (turning the phone) refits wherever the page is.
 *
 * Phones only (lg:hidden); on a laptop the buttons sit in the sticky column.
 * The data-ask-dock mark keeps the floating Ask launcher away on this page.
 */
export function StickyActions({ title, phone }: { title: string; phone: { e164: string; display: string } }) {
  const bar = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  // Server: the bar is up (the first-paint script corrects that before anything is drawn). Client: read the page.
  const why = useSyncExternalStore(subscribe, read, away);
  const ready = useSyncExternalStore(never, yes, no);

  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    let width = window.innerWidth;
    fitFirstScreen(el);
    const onResize = () => {
      const turned = window.innerWidth !== width;
      width = window.innerWidth;
      if (turned || window.scrollY <= TOP_PX) fitFirstScreen(el);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.documentElement.style.removeProperty("--car-first-screen");
    };
  }, []);

  useEffect(() => {
    const onSheet = (e: Event) => setSheetOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener(SHEET_EVENT, onSheet);
    return () => window.removeEventListener(SHEET_EVENT, onSheet);
  }, []);

  useEffect(() => {
    const onEnquired = (e: Event) => {
      const ref = (e as CustomEvent<{ reference?: string }>).detail?.reference;
      if (ref) setReference(ref);
    };
    window.addEventListener(ENQUIRED_EVENT, onEnquired);
    return () => window.removeEventListener(ENQUIRED_EVENT, onEnquired);
  }, []);

  // Once the component reads for itself, the mark the first-paint script left on <html> is spent.
  useEffect(() => {
    if (ready) document.documentElement.removeAttribute("data-car-row");
  }, [ready]);

  const hidden = sheetOpen || why !== null;
  const quiet = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-green-500/40 text-sm font-semibold text-green-200";
  return (
    <>
      {/* Away = slid down by its own height plus its offset from the bottom: out of the viewport, behind the tab bar
          on the way. Transform only, on the compositor, with a long ease-out: a drawer closing, not a fade. */}
      <div
        ref={bar}
        data-ask-dock
        data-ready={ready || undefined}
        aria-hidden={hidden}
        inert={hidden || undefined}
        className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-2 border-t border-border-default bg-surface-0 px-4 py-2.5 transition-transform duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none lg:hidden ${
          hidden ? "pointer-events-none translate-y-[calc(100%+4rem+env(safe-area-inset-bottom)+2px)]" : ""
        }`}
      >
        {/* One tap to a person, as a marketplace offers; the enquiry stays the recorded route. */}
        <a href={`tel:${phone.e164}`} aria-label={`Call Sabicars on ${phone.display}`} className={quiet}>
          <Phone aria-hidden size={18} /> Call
        </a>
        {/* The team, in the chat — Sabi answers if nobody is free — the same room as "Chat with seller" under the photo. */}
        <AskButton seller label={`Chat with the seller about the ${title}`} className={quiet}>
          <MessageCircle aria-hidden size={18} /> Chat
        </AskButton>
        {/* A written question: the enquiry sheet, opened on "Ask a question". A plain anchor, not next/link: a second tap
            on the same hash must open the sheet again, and Link's same-page navigation does not. */}
        {reference ? (
          <a
            href="#ask-question"
            aria-label={`Your enquiry is saved. Reference ${reference}`}
            className="figures inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 text-sm font-semibold text-green-100"
          >
            <Check aria-hidden size={16} /> {reference}
          </a>
        ) : (
          <ButtonAnchor href="#ask-question" arrow className="!px-4">
            Enquire
          </ButtonAnchor>
        )}
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIRST_PAINT }} />
    </>
  );
}
