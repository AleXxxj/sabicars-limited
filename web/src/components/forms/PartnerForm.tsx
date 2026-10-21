"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registerPartner } from "@/lib/actions/partners";
import { PARTNER_REACH } from "@/lib/referral";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, PrivacyLink, SpamGuard } from "./shared";

/** Copies a piece of text and says so for a moment. If the clipboard is blocked, the text is on screen to copy by hand. */
export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* Clipboard blocked: the text is on screen to copy by hand. */
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A partner's referral link, with the two ways they will use it: copied, or sent on WhatsApp with a ready message. */
export function ReferralShare({ link }: { link: string }) {
  const share = `Looking for a car? Sabicars has luxury cars, Hiace buses, SUVs and trucks in Lagos, with the 40% Drive Plan through Autochek. See what's in stock: ${link}`;
  return (
    <>
      <p className="text-sm font-medium text-text-secondary">Your link</p>
      <p className="mt-2 break-all text-text-primary">{link}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <CopyButton text={link} />
        <ButtonAnchor href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">
          Share on WhatsApp
        </ButtonAnchor>
      </div>
    </>
  );
}

/** The partner's private page link — earnings, and the bank account they are paid into — with the warning that it is theirs alone. */
export function PrivatePageLink({ link }: { link: string }) {
  return (
    <>
      <p className="text-sm font-medium text-text-secondary">Your private page</p>
      <p className="mt-2 break-all text-text-primary">{link}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonAnchor href={link} variant="secondary">
          Open your page
        </ButtonAnchor>
        <CopyButton text={link} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-text-secondary">
        Keep this link to yourself: it shows your earnings and is where you register the bank account you are paid into.
      </p>
    </>
  );
}

/** What a partner sees once registered: their code, their link, their private page, and the two ways they will use the link. */
function Welcome({ name, code, link, pageLink, returning }: { name?: string; code: string; link: string; pageLink?: string; returning?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
  }, []);

  return (
    <div ref={ref} role="status" className="surface-card scroll-mt-24 !border-green-500/30 p-7 md:p-9">
      <p className="kicker">{returning ? "Already registered" : "Registered"}</p>
      <h3 className="mt-3 text-display-3">{returning ? `Welcome back${name ? `, ${name}` : ""}.` : `You’re a Sabicars partner${name ? `, ${name}` : ""}.`}</h3>
      <p className="mt-4 text-text-secondary">{returning ? "This number is already registered. Your code is:" : "Your partner code is:"}</p>
      <p className="figures text-brand mt-2 font-display text-[3.75rem] leading-none tracking-[0.08em]">{code}</p>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <ReferralShare link={link} />
      </div>

      {returning && !pageLink && (
        <p className="mt-4 text-sm text-text-secondary">
          Your private page link is not shown here, because this number could be typed by anyone. It has been sent again to the email on your
          registration; if you gave none, ask Sabicars and the team will send it to your WhatsApp.
        </p>
      )}
      {pageLink && (
        <div className="mt-8 border-t border-border-subtle pt-6">
          <PrivatePageLink link={pageLink} />
        </div>
      )}

      <p className="mt-8 text-sm leading-relaxed text-text-muted">
        Anyone who opens your link and then enquires is recorded against your code. Buyers who visit the showroom can simply give
        your code. When a sale you brought is final, your commission goes into a bank account in your own name, registered on your
        private page — Sabicars confirms your identity and account before your first payout.
      </p>
    </div>
  );
}

export function PartnerForm() {
  const [state, action, pending] = useActionState(registerPartner, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  if (state?.ok && state.code && state.link) {
    return <Welcome name={state.name} code={state.code} link={state.link} pageLink={state.pageLink} returning={state.returning} />;
  }

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
        <input type="checkbox" name="agree" value="yes" defaultChecked={v.agree === "yes"} className="mt-1 size-4 shrink-0 accent-[var(--green-500)]" />
        <span>I have read the programme rules: it is free, I am paid only when a buyer I sent completes a purchase, and I earn nothing for signing others up.</span>
      </label>
      <FieldError message={err.agree} />

      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Registering…" : "Register as a partner"}
        </Button>
        <p className="mt-4 text-xs text-text-muted">Your number is used to identify you and to pay your commission. It is never shared. <PrivacyLink /></p>
      </div>
    </form>
  );
}
