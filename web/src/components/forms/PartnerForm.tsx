"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registerPartner } from "@/lib/actions/partners";
import { PARTNER_REACH } from "@/lib/referral";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, SpamGuard } from "./shared";

/** What a partner sees once registered: their code, their link, and the two ways they will use it. */
function Welcome({ name, code, link, returning }: { name?: string; code: string; link: string; returning?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  }, []);

  const share = `Looking for a car? Sabicars has verified luxury cars, Hiace buses, SUVs and trucks — and you can drive home on 40%. See what's in stock: ${link}`;

  return (
    <div ref={ref} role="status" className="scroll-mt-24 border border-gold-700 bg-surface-0 p-8">
      <p className="eyebrow">{returning ? "Already registered" : "Registered"}</p>
      <h3 className="mt-3 text-display-3">{returning ? `Welcome back${name ? `, ${name}` : ""}.` : `You’re a Sabicars partner${name ? `, ${name}` : ""}.`}</h3>
      <p className="mt-4 text-text-secondary">{returning ? "This number is already registered. Your code is:" : "Your partner code is:"}</p>
      <p className="figures mt-2 font-display text-[3.5rem] leading-none tracking-[0.08em] text-accent-text">{code}</p>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <p className="eyebrow !text-text-secondary">Your link</p>
        <p className="mt-2 break-all text-text-primary">{link}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                /* Clipboard blocked: the link is on screen to copy by hand. */
              }
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(share)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center rounded-[2px] bg-cta px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cta-fg [font-stretch:115%] hover:bg-cta-hover"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-text-muted">
        Anyone who opens your link and then enquires is recorded against your code. Buyers who visit the showroom can simply give
        your code. When a sale you brought completes, Sabicars contacts you on the number you registered to pay your commission.
      </p>
    </div>
  );
}

export function PartnerForm() {
  const [state, action, pending] = useActionState(registerPartner, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  if (state?.ok && state.code && state.link) return <Welcome name={state.name} code={state.code} link={state.link} returning={state.returning} />;

  return (
    <form action={action} className="grid gap-6" noValidate>
      <SpamGuard />
      {state?.error && (
        <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

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
        <Label>Where will you find buyers?</Label>
        <select key={`r-${v.reach ?? ""}`} name="reach" defaultValue={v.reach ?? ""} className={fieldClass}>
          <option value="" disabled>
            Choose…
          </option>
          {PARTNER_REACH.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <FieldError message={err.reach} />
      </label>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
        <input type="checkbox" name="agree" value="yes" defaultChecked={v.agree === "yes"} className="mt-1 size-4 shrink-0 accent-[var(--gold-500)]" />
        <span>I have read the programme rules: it is free, I am paid only when a buyer I sent completes a purchase, and I earn nothing for signing others up.</span>
      </label>
      <FieldError message={err.agree} />

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Registering…" : "Register as a partner"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your number is used to identify you and to pay your commission. It is never shared.</p>
      </div>
    </form>
  );
}
