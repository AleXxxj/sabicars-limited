"use client";

import { useActionState } from "react";
import { submitContact } from "@/lib/actions/leads";
import { Button } from "@/components/ui/Button";
import { Confirmation, FieldError, fieldClass, Label, SpamGuard } from "./shared";

const TOPICS = [
  { value: "buying", label: "Buying a vehicle" },
  { value: "drive_plan", label: "The 40% Drive Plan" },
  { value: "fleet", label: "Fleet or bulk supply" },
  { value: "general", label: "Something else" },
];

export function ContactForm({ whatsappBase }: { whatsappBase: string }) {
  const [state, action, pending] = useActionState(submitContact, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <Confirmation
        name={state.name}
        reference={state.reference}
        body="A member of the Sabicars team will get back to you."
        whatsappHref={`${whatsappBase}?text=${encodeURIComponent(`Hello Sabicars, I just sent a message through your website (reference ${state.reference}).`)}`}
      />
    );
  }

  return (
    <form action={action} className="grid gap-6" noValidate>
      <SpamGuard />
      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <label className="grid gap-2">
        <Label>What is it about?</Label>
        <select key={`topic-${v.topic ?? ""}`} name="topic" defaultValue={v.topic ?? "buying"} className={fieldClass}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <Label>Your name</Label>
          <input name="name" autoComplete="name" required defaultValue={v.name} className={fieldClass} />
          <FieldError message={err.name} />
        </label>
        <label className="grid gap-2">
          <Label>Phone number</Label>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0803 123 4567" defaultValue={v.phone} className={`figures ${fieldClass}`} />
          <FieldError message={err.phone} />
        </label>
      </div>

      <label className="grid gap-2">
        <Label>Email (optional)</Label>
        <input name="email" type="email" autoComplete="email" defaultValue={v.email} className={fieldClass} />
        <FieldError message={err.email} />
      </label>

      <label className="grid gap-2">
        <Label>Your message</Label>
        <textarea name="message" rows={5} required defaultValue={v.message} className={`${fieldClass} py-3 leading-relaxed`} />
        <FieldError message={err.message} />
      </label>

      <fieldset>
        <legend className="eyebrow mb-3 !text-text-secondary">How should we reply?</legend>
        <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
          {[
            ["phone", "A phone call"],
            ["whatsapp", "WhatsApp"],
            ["email", "Email"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex min-h-11 items-center gap-3">
              <input type="radio" name="preferredContact" value={value} defaultChecked={(v.preferredContact ?? "phone") === value} className="size-4 accent-[var(--gold-500)]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : "Send message"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your details are used only to reply to this message.</p>
      </div>
    </form>
  );
}
