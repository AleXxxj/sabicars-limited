"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { ENQUIRED_EVENT } from "./enquired";
import { SHEET_EVENT } from "./EnquirySheet";

/** Why the bar is out of sight: the page's own row of buttons is on screen, or the page has reached other cars. */
type Away = "row" | "similar" | null;

/**
 * Where the bar's top edge sits in the viewport. From the bar itself when it is in the document: the window's
 * height less its offset from the bottom (the tab bar and the home indicator) and its own height — transforms
 * do not change offsetHeight, so this holds while the bar is slid away. On the first render of a client-side
 * navigation the bar is not in the document yet, so its place is read off the tab bar instead: the bar's
 * bottom edge sits on the tab bar's content, just under its 1px border, and its height is its classes
 * (py-2.5, min-h-12, a 1px border: 4.25rem + 1px).
 */
function barTop(bar: HTMLElement | null, tab: HTMLElement) {
  if (bar) return window.innerHeight - parseFloat(getComputedStyle(bar).bottom) - bar.offsetHeight;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return tab.getBoundingClientRect().top + 1 - (4.25 * rem + 1);
}

/**
 * What stands in the bar's way right now. The row under the photo (Reserve, Book a viewing, Chat with seller)
 * counts as on screen from the moment any of it rises above where the bar would be until all of it has gone
 * over the top; "Similar vehicles" counts from the moment its top edge comes into view, and from there on
 * the page is about other cars, so the bar stays away. Nothing on a laptop, where there is no tab bar.
 */
function read(): Away {
  const tab = document.querySelector<HTMLElement>('nav[aria-label="Quick"]');
  if (!tab || !tab.offsetHeight) return null;
  const top = barTop(document.querySelector<HTMLElement>("[data-ask-dock]"), tab);
  const row = document.getElementById("primary-actions")?.getBoundingClientRect();
  if (row && row.bottom > 0 && row.top < top) return "row";
  const similar = document.getElementById("similar")?.getBoundingClientRect();
  if (similar && similar.top < top) return "similar";
  return null;
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

/*
 * The same reading, run by the browser as the page is parsed, before React is on the page: on a tall phone the
 * row can already be on the first screen, and the bar must not paint over it for even a frame. It marks <html>,
 * and a rule in globals.css keeps the bar away until this component is ready and reads for itself. On a
 * client-side navigation React does not run inline scripts, and the first render reads the page instead.
 * The tab bar is not parsed yet at this point, so the bar's own box gives its place.
 */
const FIRST_PAINT =
  '(function(){var r=document.getElementById("primary-actions"),b=document.querySelector("[data-ask-dock]");if(!r||!b)return;' +
  'var s=getComputedStyle(b);if(s.display==="none")return;var t=innerHeight-parseFloat(s.bottom)-b.offsetHeight,x=r.getBoundingClientRect();' +
  'if(x.bottom>0&&x.top<t)document.documentElement.setAttribute("data-car-row","on-screen")})();';

/**
 * The phone bar on a car's page: Call, a chat with the team, and a written question (the enquiry sheet,
 * opened on "Ask a question"). Nothing else: no name, no price, the page has those. It is in sight on arrival
 * when the page's own row of buttons is below the fold, and it never shows at the same time as that row: it
 * slides away while the row is on screen and comes back once the row has scrolled past. It goes for good once
 * "Similar vehicles" comes into view, and steps aside while the enquiry sheet is open. Solid, not glass: an
 * orange button scrolling under a see-through bar lit the whole bar orange, which read as a broken page.
 * Once an enquiry is saved, "Enquire" becomes the reference.
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
      <div
        ref={bar}
        data-ask-dock
        data-ready={ready || undefined}
        aria-hidden={hidden}
        inert={hidden || undefined}
        className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-2 border-t border-border-default bg-surface-0 px-4 py-2.5 transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none lg:hidden ${
          hidden ? "pointer-events-none translate-y-[120%] opacity-0" : ""
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
