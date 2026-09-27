"use client";

import type { ReactNode } from "react";
import { openAssistant } from "@/lib/assistant/open";

/** Opens Ask Sabicars with the question already asked — the page already knows what the buyer is looking at. */
export function AskButton({
  prompt,
  className,
  children,
  label,
}: {
  prompt?: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button type="button" onClick={() => openAssistant(prompt)} className={className} aria-label={label}>
      {children}
    </button>
  );
}
