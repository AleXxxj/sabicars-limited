"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useSyncExternalStore } from "react";
import { MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldError, fieldClass, Label, SpamGuard } from "@/components/forms/shared";
import { sendPartnerLink } from "@/lib/actions/partners";
import { forgetPartner, parseRemembered, rememberedRaw, rememberPartner, subscribeRemembered } from "@/lib/partner-device";

/**
 * Log in for Refer & Earn partners. A phone that opened its partner page
 * before goes straight back to it. Otherwise: type the number you registered
 * with, and your page link goes to your email.
 */
export function PartnerLogIn({ helpPhone, whatsappHref }: { helpPhone: string; whatsappHref: string }) {
  const raw = useSyncExternalStore(subscribeRemembered, rememberedRaw, () => null);
  const remembered = parseRemembered(raw);
  const [state, action, pending] = useActionState(sendPartnerLink, null);

  if (remembered) {
    return (
      <div className="surface-card p-6 md:p-8">
        <p className="text-sm text-text-muted">On this phone</p>
        <p className="mt-2 font-display text-[1.9rem] leading-tight text-text-primary">Welcome back, {remembered.firstName}.</p>
        <ButtonLink href={`/partner/${remembered.token}`} size="lg" arrow className="mt-6 w-full sm:w-auto">
          Open my partner page
        </ButtonLink>
        <button type="button" onClick={forgetPartner} className="mt-5 block min-h-11 text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary">
          Not you? Log in with another number
        </button>
      </div>
    );
  }

  if (state?.sent) {
    return (
      <div role="status" className="surface-card !border-green-500/30 p-6 md:p-8">
        <MailCheck aria-hidden size={28} className="text-green-300" />
        <p className="mt-4 font-display text-[1.9rem] leading-tight text-text-primary">Check your email.</p>
        <p className="mt-3 text-text-secondary">
          If this number is registered, we have sent your page link to the email you gave us. It can take a few minutes.
        </p>
        <p className="mt-5 text-sm text-text-muted">
          No email? Call{" "}
          <span className="figures text-text-primary">{helpPhone}</span> or{" "}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-text-primary underline underline-offset-2 hover:text-accent-text">
            message us on WhatsApp
          </a>
          , and we send it to you.
        </p>
      </div>
    );
  }

  return (
    <>
    {/* The instruction belongs to the form alone: a remembered phone, or one that has just sent, needs no telling. */}
    <p className="mb-8 text-lg text-text-secondary">Type the phone number you registered with. We send your page link to your email.</p>
    <form action={action} className="surface-card relative grid gap-5 p-6 md:p-8">
      <SpamGuard />
      <label className="grid gap-2">
        <Label>Your phone number</Label>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state?.phone ?? ""}
          placeholder="e.g. 0803 123 4567"
          aria-invalid={Boolean(state?.fieldError)}
          className={fieldClass}
        />
        <FieldError message={state?.fieldError} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send my link"}
      </Button>
      <p className="text-sm text-text-muted">
        Not a partner yet?{" "}
        <Link href="/partners#register" className="font-semibold text-green-300 hover:text-green-200">
          Register free
        </Link>
      </p>
    </form>
    </>
  );
}

/**
 * On the partner's own page: keeps this phone logged in, and offers to log out.
 * The page is remembered once, when it opens: an effect syncing the browser's
 * storage, so a later redraw (the log-out itself) can never save it again.
 */
export function RememberPartner({ token, firstName }: { token: string; firstName: string }) {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribeRemembered, rememberedRaw, () => null);
  const here = parseRemembered(raw)?.token === token;
  useEffect(() => {
    rememberPartner({ token, firstName });
  }, [token, firstName]);
  return (
    <>
      {here && (
        <button
          type="button"
          onClick={() => {
            forgetPartner();
            router.push("/");
          }}
          className="min-h-11 text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          Log out on this phone
        </button>
      )}
    </>
  );
}
