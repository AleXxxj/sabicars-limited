"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Phone, Sparkles } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { ENQUIRED_EVENT } from "./enquired";
import { SHEET_EVENT } from "./EnquirySheet";

/**
 * The phone bar on a car's page: the price and the next step within thumb
 * reach while the buyer reads. It is a shortcut to the page's own buttons,
 * so it steps aside whenever those buttons are on the screen themselves —
 * two "Enquire" buttons in view at once read as two different things — and
 * while the enquiry sheet is open over the page. Once an enquiry is saved,
 * its "Enquire" becomes the reference: the page stops asking for what it
 * already has.
 *
 * Phones only (lg:hidden); on a laptop the buttons sit in the sticky column.
 * The data-ask-dock mark stays on the bar whether it is showing or not: the
 * floating Ask launcher stays away on this page, rather than popping in and
 * out as the buyer scrolls past the buttons.
 */
export function StickyActions({ title, price, phone }: { title: string; price: string; phone: { e164: string; display: string } }) {
  const bar = useRef<HTMLDivElement>(null);
  // null until the first measurement: the bar is painted invisible until it knows whether it belongs.
  const [buttonsOnScreen, setButtonsOnScreen] = useState<boolean | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const aside = buttonsOnScreen === null ? null : buttonsOnScreen || sheetOpen;

  useEffect(() => {
    const onSheet = (e: Event) => setSheetOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener(SHEET_EVENT, onSheet);
    return () => window.removeEventListener(SHEET_EVENT, onSheet);
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
  return (
    <div
      ref={bar}
      data-ask-dock
      aria-hidden={hidden}
      inert={hidden || undefined}
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-border-default bg-surface-0/95 px-4 py-2.5 backdrop-blur-md lg:hidden ${
        // No transition before the first measurement: the bar appears where it belongs, or not at all, rather than sliding away.
        aside === null ? "opacity-0" : "transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
      } ${aside ? "pointer-events-none translate-y-[120%] opacity-0" : ""}`}
    >
      <div className="min-w-0">
        <p className="truncate text-xs text-text-muted">{title}</p>
        <p className="figures truncate font-semibold">{price}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* One tap to a person, as a marketplace offers; the enquiry stays the recorded route. */}
        <a
          href={`tel:${phone.e164}`}
          aria-label={`Call Sabicars on ${phone.display}`}
          className="inline-flex size-12 items-center justify-center rounded-full border border-green-500/40 text-green-200"
        >
          <Phone aria-hidden size={18} />
        </a>
        <AskButton
          prompt={`Tell me about the ${title}`}
          label={`Ask Sabicars about the ${title}`}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-green-500/40 px-4 text-sm font-semibold text-green-200"
        >
          <Sparkles aria-hidden size={16} /> Ask
        </AskButton>
        {/* Plain anchors, not next/link: a second tap on the same hash must scroll again, and Link's same-page navigation does not. */}
        {reference ? (
          <a
            href="#enquire"
            aria-label={`Your enquiry is saved. Reference ${reference}`}
            className="figures inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-4 text-sm font-semibold text-green-100"
          >
            <Check aria-hidden size={16} /> {reference}
          </a>
        ) : (
          <ButtonAnchor href="#enquire" arrow className="shrink-0">
            Enquire
          </ButtonAnchor>
        )}
      </div>
    </div>
  );
}
