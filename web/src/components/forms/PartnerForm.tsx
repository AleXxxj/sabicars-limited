"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { registerPartner } from "@/lib/actions/partners";
import { DRIVE_PLAN } from "@/lib/drive-plan";
import { markSignedIn } from "@/lib/partner-flag";
import { PARTNER_REACH } from "@/lib/referral";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
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
  // The Drive Plan only with its two conditions: the car's year, and Autochek's yes (lib/drive-plan.ts).
  const share = `Looking for a car? Sabicars in Lagos has Hummer buses, SUVs, saloon cars and trucks, all with photos and prices. On a car from ${DRIVE_PLAN.standardYear} you can pay 40% now, and Autochek lends you the rest if they approve you. See the cars: ${link}`;
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

/**
 * What a partner sees once registered: their code, their link, and the way to
 * their page. A new partner is already logged in on this phone. A number that
 * was already registered logs nobody in: the way in is Log in, with the PIN.
 */
function Welcome({ name, code, link, returning, loggedIn }: { name?: string; code: string; link: string; returning?: boolean; loggedIn?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    // Logged in by the registration itself: the header shows Account at once, without a reload.
    if (loggedIn) markSignedIn();
  }, [loggedIn]);

  return (
    <div ref={ref} role="status" className="surface-card scroll-mt-24 !border-green-500/30 p-7 md:p-9">
      <p className="kicker">{returning ? "Already registered" : "Registered"}</p>
      <h3 className="mt-3 text-display-3">{returning ? `Welcome back${name ? `, ${name}` : ""}.` : `You’re a Sabicars partner${name ? `, ${name}` : ""}.`}</h3>
      <p className="mt-4 text-text-secondary">{returning ? "This number is already registered. Your code is:" : "Your partner code is:"}</p>
      <p className="figures text-brand mt-2 font-display text-[3.75rem] leading-none tracking-[0.08em]">{code}</p>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <ReferralShare link={link} />
      </div>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <p className="text-sm font-medium text-text-secondary">Your partner page</p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {returning
            ? "Log in with your phone number and your PIN to see your buyers and your earnings."
            : "Your buyers, your earnings, and the bank account you are paid into. You are logged in on this phone. On another phone, log in with your number and PIN."}
        </p>
        <ButtonLink href="/partner" variant="secondary" className="mt-5">
          {returning ? "Log in" : "Open your page"}
        </ButtonLink>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-text-muted">
        Anyone who opens your link and then enquires is recorded against your code. Buyers who visit the showroom can simply give
        your code. When a sale you brought is final, your commission goes into a bank account in your own name, which you add on
        your page. Sabicars confirms your identity and account before your first payout.
      </p>
    </div>
  );
}

export function PartnerForm() {
  const [state, action, pending] = useActionState(registerPartner, null);
  const v = state?.values ?? {};
  const err = state?.fieldErrors ?? {};

  if (state?.ok && state.code && state.link) {
    return <Welcome name={state.name} code={state.code} link={state.link} returning={state.returning} loggedIn={state.loggedIn} />;
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
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="grid gap-2">
          <Label>Choose a 6-digit PIN</Label>
          <input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="new-password" required placeholder="••••••" className={`figures tracking-[0.4em] ${fieldClass}`} />
          <FieldError message={err.pin} />
        </label>
        <label className="grid gap-2">
          <Label>Type the PIN again</Label>
          <input name="pinAgain" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="new-password" required placeholder="••••••" className={`figures tracking-[0.4em] ${fieldClass}`} />
          <FieldError message={err.pinAgain} />
        </label>
      </div>
      <p className="-mt-3 text-sm text-text-muted">You log in with your phone number and this PIN. Don&rsquo;t share it with anyone.</p>
      <label className="grid gap-2">
        <Label>Email (optional)</Label>
        <input name="email" type="email" autoComplete="email" defaultValue={v.email} className={fieldClass} />
        <span className="text-sm text-text-muted">Only used to send you a link if you forget your PIN.</span>
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
