"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ReviewForm } from "./ReviewForm";

/** Other parts of the page (the review prompt) open the form with this event. */
export const OPEN_REVIEW_EVENT = "sabicars:write-review";

export function WriteReview({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  // A fresh form each time it opens, so a second review never shows the last one's thank-you.
  const [round, setRound] = useState(0);
  useEffect(() => {
    const show = () => {
      setRound((r) => r + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_REVIEW_EVENT, show);
    return () => window.removeEventListener(OPEN_REVIEW_EVENT, show);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
      >
        <PenLine aria-hidden size={17} /> Write a review
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Write a review">
        <ReviewForm key={round} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
