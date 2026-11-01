"use client";

import { useEffect, useState } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { ENQUIRED_EVENT } from "./enquired";
import { SHEET_EVENT } from "./EnquirySheet";

/**
 * The phone bar on a car's page: three ways to act within thumb reach from
 * the first screen on. Call, a chat with the team, and a written question
 * (the enquiry sheet, opened on "Ask a question"). Nothing else: no name,
 * no price, the page has those. It is painted with the page, so it is the
 * first thing in sight on arrival, and steps aside only while the enquiry
 * sheet is open over it. Solid, not glass: an orange button scrolling under
 * a see-through bar lit the whole bar orange, which read as a broken page.
 * Once an enquiry is saved, "Enquire" becomes the reference.
 *
 * Phones only (lg:hidden); on a laptop the buttons sit in the sticky column.
 * The data-ask-dock mark keeps the floating Ask launcher away on this page.
 */
export function StickyActions({ title, phone }: { title: string; phone: { e164: string; display: string } }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

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

  const quiet = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-green-500/40 text-sm font-semibold text-green-200";
  return (
    <div
      data-ask-dock
      aria-hidden={sheetOpen}
      inert={sheetOpen || undefined}
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-2 border-t border-border-default bg-surface-0 px-4 py-2.5 transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none lg:hidden ${
        sheetOpen ? "pointer-events-none translate-y-[120%] opacity-0" : ""
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
  );
}
