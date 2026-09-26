"use client";

import { useEffect, useRef, useState } from "react";

// Kept in a plain module so Server Components can use it too.
export { fieldClass } from "./field";

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow !text-text-secondary">{children}</span>;
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
    <div ref={ref} role="status" className="scroll-mt-24 border border-gold-700 bg-surface-0 p-8">
      <p className="eyebrow">Received</p>
      <h3 className="mt-3 text-display-3">Thank you{name ? `, ${name}` : ""}.</h3>
      <p className="mt-4 text-text-secondary">
        Your reference is <strong className="figures text-text-primary">{reference}</strong>. {body}
      </p>
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="eyebrow mt-8 inline-flex min-h-12 items-center gap-2">
        Prefer WhatsApp? Continue there with your reference →
      </a>
    </div>
  );
}
