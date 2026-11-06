import type { Metadata } from "next";
import { SetPinForm } from "@/components/partner/PartnerLogIn";
import { ButtonLink } from "@/components/ui/Button";
import { partnerByPinLink } from "@/lib/partner-pin-links";

/** No referrer: the address carries a one-time key, and no link out of this page may leak it. */
export const metadata: Metadata = { title: "Choose a new PIN", robots: { index: false, follow: false }, referrer: "no-referrer" };

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ secret: string }> };

/** The emailed "choose / reset your PIN" link: one use, one hour. */
export default async function PinLinkPage({ params }: Props) {
  const { secret } = await params;
  const partner = await partnerByPinLink(secret);

  if (!partner) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <p className="kicker">Earn</p>
        <h1 className="mt-4 text-display-3">This link has expired.</h1>
        <p className="mt-4 text-text-secondary">A PIN link works once, for one hour. Ask for a new one and use it straight away.</p>
        <ButtonLink href="/partner/forgot" variant="secondary" className="mt-8">
          Send me a new link
        </ButtonLink>
      </section>
    );
  }

  const firstName = partner.name.trim().split(/\s+/)[0];
  return (
    <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
      <p className="kicker">Earn</p>
      <h1 className="mt-4 text-display-2">{partner.pinHash ? `Choose a new PIN, ${firstName}.` : `Hello, ${firstName}. Choose your PIN.`}</h1>
      <p className="mt-4 text-lg text-text-secondary">You log in with your phone number and this PIN, on any phone.</p>
      <div className="mt-8">
        <SetPinForm via="link" secret={secret} />
      </div>
    </section>
  );
}
