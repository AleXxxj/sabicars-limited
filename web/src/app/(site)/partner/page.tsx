import type { Metadata } from "next";
import Link from "next/link";
import { PartnerLogIn } from "@/components/partner/PartnerLogIn";
import { helpPhone, pageAddress, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Log in",
  description: "Refer & Earn partners: open your partner page to see your buyers, your earnings and your payments.",
  robots: { index: false, follow: true },
  ...pageAddress("/partner"),
};

/**
 * Log in, from the header on every page. Partners have no password: their
 * page opens with the private link they were given. A phone that opened it
 * before goes straight back; anyone else types their number and the link goes
 * to their email. Staff sign in on their own page.
 */
export default function LogInPage() {
  return (
    <section className="mx-auto max-w-xl px-5 py-14 md:px-10 md:py-24">
      <p className="kicker">Refer &amp; Earn</p>
      <h1 className="mt-4 text-display-2">Log in to your partner page.</h1>
      <div className="mt-5">
        <PartnerLogIn helpPhone={helpPhone} whatsappHref={whatsappLink("Hello Sabicars, I am a Refer & Earn partner and I need my partner page link.")} />
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
