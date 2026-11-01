"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { ENQUIRED_EVENT } from "./enquired";
import { SHEET_EVENT } from "./EnquirySheet";

/**
 * The phone bar on a car's page: three ways to act within thumb reach while
 * the buyer reads. Call, a chat with the team, and a written question (the
 * enquiry sheet, opened on "Ask a question"). Nothing else: no name, no
 * price, the page has those.
 *
 * It is a shortcut to the page's own buttons, so it keeps out of their way:
 * it does not appear until the buyer has scrolled (on landing, a phone's
 * address bar is tall and see-through, and an orange bar over an orange
 * button showing through the glass read as a broken page), it steps aside
 * while those buttons are on screen, and while the enquiry sheet is open.
 * Once an enquiry is saved, "Enquire" becomes the reference.
 *
 * Phones only (lg:hidden); on a laptop the buttons sit in the sticky column.
 * The data-ask-dock mark stays on the bar whether it is showing or not: the
 * floating Ask launcher stays away on this page, rather than popping in and
 * out as the buyer scrolls past the buttons.
 */
export function StickyActions({ title, phone }: { title: string; phone: { e164: string; display: string } }) {
  const bar = useRef<HTMLDivElement>(null);
  // null until the first measurement: the bar is painted invisible until it knows whether it belongs.
  const [buttonsOnScreen, setButtonsOnScreen] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const aside = buttonsOnScreen === null ? null : buttonsOnScreen || sheetOpen || !scrolled;

  useEffect(() => {
    const onSheet = (e: Event) => setSheetOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener(SHEET_EVENT, onSheet);
    return () => window.removeEventListener(SHEET_EVENT, onSheet);
  }, []);

  // Not before the buyer has moved: a bar that is there on arrival competes with the page's own first screen.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const first = setTimeout(onScroll, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const targets = ["primary-actions"].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length || typeof IntersectionObserver === "undefined") {
      // Nothing to watch: show the bar, once this render has settled.
      const show = setTimeout(() => setButtonsOnScreen(false), 0);
      return () => clearTimeout(show);
    }
    let watcher: IntersectionObserver | null = null;
    const seen = new Set<Element>();
    const watch = () => {
      watcher?.disconnect();
      seen.clear();
      // The strip the bar and the tab bar cover, and the header above, are not "on screen": a button hidden
      // behind the bar has not been seen. Measured here, and again when the screen changes shape.
      const rect = bar.current?.getBoundingClientRect();
      const covered = rect && rect.height > 0 ? Math.max(0, Math.round(window.innerHeight - rect.top)) : 0;
      const header = Math.round(document.querySelector("header")?.getBoundingClientRect().bottom ?? 64);
      watcher = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) seen.add(e.target);
            else seen.delete(e.target);
          }
          setButtonsOnScreen(seen.size > 0);
        },
        { rootMargin: `-${header}px 0px -${covered}px 0px` },
      );
      for (const t of targets) watcher.observe(t);
    };
    watch();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(watch, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      watcher?.disconnect();
    };
  }, []);

  useEffect(() => {
    const onEnquired = (e: Event) => {
      const ref = (e as CustomEvent<{ reference?: string }>).detail?.reference;
      if (ref) setReference(ref);
    };
    window.addEventListener(ENQUIRED_EVENT, onEnquired);
    return () => window.removeEventListener(ENQUIRED_EVENT, onEnquired);
  }, []);

  const hidden = aside !== false;
  const quiet = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-green-500/40 text-sm font-semibold text-green-200";
  return (
    <div
      ref={bar}
      data-ask-dock
      aria-hidden={hidden}
      inert={hidden || undefined}
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-2 border-t border-border-default bg-surface-0/95 px-4 py-2.5 backdrop-blur-md lg:hidden ${
        // No transition before the first measurement: the bar appears where it belongs, or not at all, rather than sliding away.
        aside === null ? "opacity-0" : "transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
      } ${aside ? "pointer-events-none translate-y-[120%] opacity-0" : ""}`}
    >
      {/* One tap to a person, as a marketplace offers; the enquiry stays the recorded route. */}
      <a href={`tel:${phone.e164}`} aria-label={`Call Sabicars on ${phone.display}`} className={quiet}>
        <Phone aria-hidden size={18} /> Call
      </a>
      {/* The team, in the chat — Sabi answers if nobody is free — the same room as "Chat with seller" under the photos. */}
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
  );
}
