import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetPinForm } from "@/components/partner/PartnerLogIn";
import { ButtonLink } from "@/components/ui/Button";
import { partnerBySetupLink } from "@/lib/partner-pin-links";

/** No referrer: the address carries the partner's set-up key, and no link out of this page may leak it. */
export const metadata: Metadata = { title: "Choose your PIN", robots: { index: false, follow: false }, referrer: "no-referrer" };

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/**
 * A partner's set-up link (/partner/<access token>): the private link every
 * partner had before PINs, and the one a manager sends after resetting a PIN.
 * It lets a partner with no PIN choose one, then logs them in. Once a PIN is
 * set, the link only leads to the log-in: the PIN is the key now.
 */
export default async function SetUpLinkPage({ params }: Props) {
  const { token } = await params;
  const partner = await partnerBySetupLink(token);

  if (!partner) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <p className="kicker">Refer &amp; Earn</p>
        <h1 className="mt-4 text-display-3">This link is not valid.</h1>
        <p className="mt-4 text-text-secondary">
          It may have been copied incompletely. Log in with your phone number and PIN. If you have no PIN yet, the team can send you a new
          link.
        </p>
        <ButtonLink href="/partner" variant="secondary" className="mt-8">
          Log in
        </ButtonLink>
      </section>
    );
  }
  if (partner.pinHash) redirect("/partner");

  const firstName = partner.name.trim().split(/\s+/)[0];
  return (
    <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
      <p className="kicker">Refer &amp; Earn</p>
      <h1 className="mt-4 text-display-2">Hello, {firstName}. Choose your PIN.</h1>
      <p className="mt-4 text-lg text-text-secondary">
        From now on you log in with your phone number and a 6‑digit PIN, on any phone.
      </p>
      <div className="mt-8">
        <SetPinForm via="setup" secret={token} />
      </div>
    </section>
  );
}
