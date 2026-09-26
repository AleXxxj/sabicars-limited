"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitEnquiry } from "@/lib/actions/enquiry";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { fieldClass as field } from "@/components/forms/field";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

/**
 * The replacement for "WhatsApp us" on every tile.
 *
 * The enquiry is saved before anything else happens, and the customer is given
 * a reference. WhatsApp is still offered — some people will always prefer it —
 * but as a next step that carries the reference, so the conversation can be
 * matched to its record instead of vanishing into one person's phone.
 */
export function EnquiryForm({
  vehicleId,
  vehicleTitle,
  landingPath,
  whatsappBase,
}: {
  vehicleId: string;
  vehicleTitle: string;
  landingPath: string;
  whatsappBase: string;
}) {
  const [state, action, pending] = useActionState(submitEnquiry, null);
  const [type, setType] = useState<"question" | "viewing">("question");
  // Captured once, when the form first renders — the anti-bot timing check.
  const [renderedAt] = useState(() => Date.now());
  const confirmation = useRef<HTMLDivElement>(null);

  // The thank-you panel is shorter than the form it replaces, which leaves the
  // screen showing whatever came next. Bring the confirmation into view.
  useEffect(() => {
    if (!state?.ok) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    confirmation.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  }, [state?.ok]);

  if (state?.ok) {
    const wa = `${whatsappBase}?text=${encodeURIComponent(
      `Hello Sabicars, I just enquired about the ${vehicleTitle} on your website (reference ${state.reference}).`,
    )}`;
    return (
      <div ref={confirmation} role="status" className="surface-card scroll-mt-24 !border-gold-500/30 p-7 md:p-9">
        <p className="kicker">Enquiry received</p>
        <h3 className="mt-3 text-display-3">Thank you, {state.name}.</h3>
        <p className="mt-4 text-text-secondary">
          Your reference is <strong className="figures text-text-primary">{state.reference}</strong>. A member of the Sabicars team will
          contact you about the {vehicleTitle}.
        </p>
        <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="secondary" arrow className="mt-8 w-full sm:w-auto">
          Continue on WhatsApp with your reference
        </ButtonAnchor>
      </div>
    );
  }

  const tab = (value: typeof type, label: string) => (
    <label
      className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full text-[0.95rem] font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${
        type === value
          ? "bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] text-[#0A0908] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
      {label}
    </label>
  );

  return (
    <form action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="landingPath" value={landingPath} />
      <input type="hidden" name="renderedAt" value={renderedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="sr-only">What would you like to do?</legend>
        <div className="flex gap-1 rounded-full border border-border-default bg-surface-1 p-1">
          {tab("question", "Ask a question")}
          {tab("viewing", "Book a viewing")}
        </div>
      </fieldset>

      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Your name</span>
          <input name="name" autoComplete="name" required defaultValue={state?.values?.name} className={field} />
          <FieldError message={state?.fieldErrors?.name} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-text-secondary">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={state?.values?.phone} className={`figures ${field}`} />
          <FieldError message={state?.fieldErrors?.phone} />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium text-text-secondary">How should we reach you?</legend>
        <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
          <label className="inline-flex min-h-11 items-center gap-3">
            <input type="radio" name="preferredContact" value="phone" defaultChecked={state?.values?.preferredContact !== "whatsapp"} className="size-4 accent-[var(--gold-500)]" /> A phone call
          </label>
          <label className="inline-flex min-h-11 items-center gap-3">
            <input type="radio" name="preferredContact" value="whatsapp" defaultChecked={state?.values?.preferredContact === "whatsapp"} className="size-4 accent-[var(--gold-500)]" /> WhatsApp
          </label>
        </div>
      </fieldset>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-secondary">
          {type === "viewing" ? "When suits you to see it? (optional)" : "Your question (optional)"}
        </span>
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          defaultValue={state?.values?.message}
          placeholder={type === "viewing" ? "e.g. Saturday morning" : "e.g. Is the price negotiable? Can it be delivered to Abuja?"}
          className={`${field} py-3`}
        />
        <FieldError message={state?.fieldErrors?.message} />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-text-secondary">Email (optional)</span>
        <input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} className={field} />
        <FieldError message={state?.fieldErrors?.email} />
      </label>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : type === "viewing" ? "Request a viewing" : "Send enquiry"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your details are used only to reply to this enquiry.</p>
      </div>
    </form>
  );
}
