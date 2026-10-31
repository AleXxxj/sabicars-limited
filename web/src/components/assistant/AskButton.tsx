"use client";

import type { ReactNode } from "react";
import { openAssistant } from "@/lib/assistant/open";

/** A button that opens Ask Sabicars — with a question already asked, or as a chat with the team. */
export function AskButton({
  prompt,
  seller,
  className,
  children,
  label,
}: {
  prompt?: string;
  /** Open as "Chat with seller" rather than a question for Sabi. */
  seller?: boolean;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button type="button" onClick={() => openAssistant(prompt, { seller })} className={className} aria-label={label}>
      {children}
    </button>
  );
}
