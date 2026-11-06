import type { Metadata } from "next";
import { ForgotPinForm } from "@/components/partner/PartnerLogIn";
import { helpPhone, whatsappLink } from "@/lib/site";

export const metadata: Metadata = { title: "Forgot your PIN", robots: { index: false, follow: true } };

/** Forgot the PIN: a one-time link to the email the partner gave, or the team helps. */
export default function ForgotPinPage() {
  return (
    <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
      <p className="kicker">Earn</p>
      <h1 className="mt-4 text-display-2">Forgot your PIN?</h1>
      <p className="mt-4 text-lg text-text-secondary">Type your phone number. We send a link to reset your PIN to your email.</p>
      <div className="mt-8">
        <ForgotPinForm helpPhone={helpPhone} whatsappHref={whatsappLink("Hello Sabicars, I am a Sabicars partner and I forgot my PIN.")} />
      </div>
    </section>
  );
}
