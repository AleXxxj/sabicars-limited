import type { Metadata } from "next";
import Link from "next/link";
import { PartnerLogInForm } from "@/components/partner/PartnerLogIn";
import { PartnerStatementView } from "@/components/partner/PartnerStatementView";
import { partnerStatement } from "@/lib/ledger";
import { currentPartner } from "@/lib/partner-session";
import { helpPhone } from "@/lib/site";

/** Personal: the partner's page to its owner, the log-in to anyone else. Never cached, never indexed. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const me = await currentPartner();
  return { title: me ? "Your partner page" : "Log in", robots: { index: false, follow: false } };
}

/**
 * The partner's page, at one address for everyone: a partner logged in on
 * this phone sees their page; anyone else sees the log-in (phone number and
 * 6-digit PIN). The header's Log in and Account both lead here.
 */
export default async function PartnerHome() {
  const me = await currentPartner();
  const statement = me ? await partnerStatement(me.dealerId, me.id) : null;
  if (statement) return <PartnerStatementView statement={statement} />;

  return (
    <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
      <p className="kicker">Refer &amp; Earn</p>
      <h1 className="mt-4 text-display-2">Log in to your partner page.</h1>
      <p className="mt-4 text-lg text-text-secondary">Use your phone number and your 6‑digit PIN.</p>
      <div className="mt-8">
        <PartnerLogInForm helpPhone={helpPhone} />
      </div>
      <p className="mt-10 text-sm text-text-muted">
        Sabicars staff?{" "}
        <Link href="/admin/login" className="text-text-secondary underline underline-offset-4 hover:text-text-primary">
          Sign in here
        </Link>
      </p>
    </section>
  );
}
