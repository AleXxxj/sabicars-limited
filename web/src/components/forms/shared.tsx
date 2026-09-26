"use client";

import { useEffect, useRef, useState } from "react";
import { ButtonAnchor } from "@/components/ui/Button";

// Kept in a plain module so Server Components can use it too.
export { fieldClass } from "./field";

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-text-secondary">{children}</span>;
}

/**
 * The anti-spam pair every form carries: a field people never see (bots fill
 * it in) and the moment the form was shown (bots submit faster than anyone can
 * type).
 */
export function SpamGuard() {
  const [renderedAt] = useState(() => Date.now());
  return (
    <>
      <input type="hidden" name="renderedAt" value={renderedAt} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

/**
 * What the customer sees once their message is saved: a reference, and
 * WhatsApp as an optional next step that carries it — so a chat can always be
 * matched to its record instead of vanishing into one person's phone.
 */
export function Confirmation({
  name,
  reference,
  body,
  whatsappHref,
}: {
  name?: string;
  reference?: string;
  body: string;
  whatsappHref: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  }, []);
  return (
    <div ref={ref} role="status" className="surface-card scroll-mt-24 !border-gold-500/30 p-7 md:p-9">
      <p className="kicker">Received</p>
      <h3 className="mt-3 text-display-3">Thank you{name ? `, ${name}` : ""}.</h3>
      <p className="mt-4 text-text-secondary">
        Your reference is <strong className="figures text-text-primary">{reference}</strong>. {body}
      </p>
      <ButtonAnchor href={whatsappHref} target="_blank" rel="noopener noreferrer" variant="secondary" arrow className="mt-8 w-full sm:w-auto">
        Continue on WhatsApp with your reference
      </ButtonAnchor>
    </div>
  );
}
