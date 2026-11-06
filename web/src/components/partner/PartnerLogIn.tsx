"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, SpamGuard } from "@/components/forms/shared";
import { logInPartner, logOutPartner, requestPinLink, setPartnerPin } from "@/lib/actions/partners";
import { clearStaleSignedIn, markSignedIn } from "@/lib/partner-flag";

/** A 6-digit PIN box: numbers keypad on a phone, dots on screen, the browser's own password memory if the partner wants it. */
function PinInput({ name, label, autoComplete, error }: { name: string; label: string; autoComplete: "current-password" | "new-password"; error?: string }) {
  return (
    <label className="grid gap-2">
      <Label>{label}</Label>
      <input
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete={autoComplete}
        required
        placeholder="••••••"
        aria-invalid={Boolean(error)}
        className={`figures tracking-[0.4em] ${fieldClass}`}
      />
      <FieldError message={error} />
    </label>
  );
}

function PhoneInput({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <label className="grid gap-2">
      <Label>Your phone number</Label>
      <input
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        defaultValue={defaultValue}
        placeholder="e.g. 0803 123 4567"
        aria-invalid={Boolean(error)}
        className={`figures ${fieldClass}`}
      />
      <FieldError message={error} />
    </label>
  );
}

function Alert({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="border-l-2 border-danger bg-surface-2 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/**
 * Log in: phone number and PIN. The server says nobody is logged in here, so
 * a "logged in" flag left on this phone is cleared, and the header shows Log in.
 */
export function PartnerLogInForm({ helpPhone }: { helpPhone: string }) {
  const [state, action, pending] = useActionState(logInPartner, null);
  useEffect(() => clearStaleSignedIn(), []);

  if (state?.needsPin) {
    return (
      <div role="status" className="surface-card !border-green-500/30 p-6 md:p-8">
        <MailCheck aria-hidden size={28} className="text-green-300" />
        <p className="mt-4 font-display text-[1.9rem] leading-tight text-text-primary">Choose your PIN first.</p>
        <p className="mt-3 text-text-secondary">
          {state.needsPin === "emailed"
            ? "You joined before PINs. We have sent a link to your email: tap it and choose your 6-digit PIN."
            : `You joined before PINs, and gave no email. Call ${helpPhone} and we send you a link to choose your PIN.`}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="surface-card relative grid gap-5 p-6 md:p-8">
      <SpamGuard />
      <Alert message={state?.error} />
      <PhoneInput defaultValue={state?.phone} error={state?.fieldErrors?.phone} />
      <PinInput name="pin" label="Your 6-digit PIN" autoComplete="current-password" error={state?.fieldErrors?.pin} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
        <Link href="/partner/forgot" className="font-semibold text-green-300 hover:text-green-200">
          Forgot your PIN?
        </Link>
        <span className="text-text-muted">
          Not a partner yet?{" "}
          <Link href="/partners#register" className="font-semibold text-green-300 hover:text-green-200">
            Register free
          </Link>
        </span>
      </div>
    </form>
  );
}

/** Forgot the PIN: the phone number, then a one-time link to the email on record. The same answer for every number. */
export function ForgotPinForm({ helpPhone, whatsappHref }: { helpPhone: string; whatsappHref: string }) {
  const [state, action, pending] = useActionState(requestPinLink, null);

  if (state?.sent) {
    return (
      <div role="status" className="surface-card !border-green-500/30 p-6 md:p-8">
        <MailCheck aria-hidden size={28} className="text-green-300" />
        <p className="mt-4 font-display text-[1.9rem] leading-tight text-text-primary">Check your email.</p>
        <p className="mt-3 text-text-secondary">
          If this number is registered, we have sent a link to reset your PIN to the email you gave us. It works for one hour.
        </p>
        <p className="mt-5 text-sm text-text-muted">
          No email? Call <span className="figures text-text-primary">{helpPhone}</span> or{" "}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2 hover:text-accent-text">
            message us on WhatsApp
          </a>
          , and we help you reset it.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="surface-card relative grid gap-5 p-6 md:p-8">
      <SpamGuard />
      <Alert message={state?.error} />
      <PhoneInput defaultValue={state?.phone} error={state?.fieldError} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send me a reset link"}
      </Button>
      <Link href="/partner" className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary">
        Back to Log in
      </Link>
    </form>
  );
}

/** Choose a PIN, from a set-up link or an emailed one. The partner is logged in on this phone after. */
export function SetPinForm({ via, secret }: { via: "setup" | "link"; secret: string }) {
  const [state, action, pending] = useActionState(setPartnerPin, null);
  return (
    <form action={action} className="surface-card grid gap-5 p-6 md:p-8">
      <input type="hidden" name="via" value={via} />
      <input type="hidden" name="secret" value={secret} />
      <Alert message={state?.error} />
      <PinInput name="pin" label="Choose a 6-digit PIN" autoComplete="new-password" error={state?.fieldErrors?.pin} />
      <PinInput name="pinAgain" label="Type the PIN again" autoComplete="new-password" error={state?.fieldErrors?.pinAgain} />
      <p className="text-sm text-text-muted">You log in with your phone number and this PIN. Don&rsquo;t share it with anyone, not even Sabicars staff.</p>
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Save my PIN"}
      </Button>
    </form>
  );
}

/**
 * On the partner's page: logs this phone out, here and on the server. The
 * homepage it lands on comes without a full reload, so the header's Account
 * mark is cleared as the form goes, not left for the next page load.
 */
export function LogOutButton() {
  return (
    <form action={logOutPartner} onSubmit={() => document.documentElement.removeAttribute("data-partner")}>
      <button type="submit" className="min-h-11 text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary">
        Log out
      </button>
    </form>
  );
}

/** On the partner's page: a log-in that arrived without a full page load still shows Account in the header at once. */
export function SignedInMark() {
  useEffect(() => markSignedIn(), []);
  return null;
}
