"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

/** The page-wide word that the enquiry sheet opened or closed; the phone bar listens. */
export const SHEET_EVENT = "sabicars:enquiry-sheet";

/** The links that open the sheet: the enquiry itself, or one of its three ways. */
const OPENERS = ["#enquire", "#call-me-back", "#ask-question", "#book-viewing"];

/**
 * The enquiry card, in a sheet over the car's page rather than a section of
 * it. The page's own buttons and the phone bar open it; it rises from the
 * bottom on a phone and sits in the middle on a desk. The card inside keeps
 * its three ways (EnquiryForm reads the clicked link's hash to pick one), and
 * stays mounted, so a thank-you is still there if the sheet is reopened.
 */
export function EnquirySheet({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A link to the enquiry anywhere on the page opens the sheet instead of scrolling to a section that is no longer there.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      const href = link?.getAttribute("href") ?? "";
      if (!OPENERS.includes(href)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    // An address shared with one of the hashes opens the sheet on arrival, once this render has settled.
    const arrival = setTimeout(() => {
      if (OPENERS.includes(window.location.hash)) setOpen(true);
    }, 0);
    return () => {
      clearTimeout(arrival);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SHEET_EVENT, { detail: { open } }));
    // The page behind a modal sheet must not scroll with it.
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={title}>
      {children}
    </Dialog>
  );
}
