import type { Metadata } from "next";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { EarningsExamples, PartnerRules } from "@/components/referral/Referral";
import { PARTNER_TERMS } from "@/lib/referral";
import { PageIntro } from "@/components/site/PageIntro";
import { drivePlanCatalogue } from "@/lib/repositories/vehicles";
import { site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Refer & Earn — 1.5% on every buyer you send",
  description:
    "Register free as a Sabicars partner, share your personal link, and earn 1.5% of the price when a buyer you sent completes a purchase. Paid on sales only — never for recruiting.",
  alternates: { canonical: "/partners" },
};

const HOW = [
  ["Register", "Free, in a minute, with your phone number. Your personal code and link are ready at once."],
  ["Share", "Send your link on WhatsApp, Instagram or TikTok — or give your code to anyone who is buying."],
  ["They buy", "Your buyer enquires through your link, or gives your code at the showroom. It is recorded against you."],
  ["You are paid", "When the sale is final, 1.5% of the price goes into your bank account. Fleet orders count in full."],
];

/**
 * Refer & Earn.
 *
 * Its one job: turn the people who follow Sabicars into people who sell for
 * it — on terms plain enough that nobody could mistake it for the schemes
 * that prey on the same young audience. The rules are the product here, so
 * they are stated before the form, not buried under it.
 */
export default async function PartnersPage() {
  const catalogue = await drivePlanCatalogue();

  return (
    <>
      <PageIntro eyebrow="Refer & Earn" title="Send a buyer. Earn 1.5%.">
        <p>
          Know someone looking for a car, a bus or a whole fleet? Register free, share your link, and when they buy from Sabicars,
          1.5% of the price is yours.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-2 lg:items-start">
        <ScrollReveal>
          <p className="kicker">How it works</p>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2">
            {HOW.map(([step, text], i) => (
              <li key={step} className="border-t border-gold-700 pt-4">
                <p className="figures text-xs text-text-muted">0{i + 1}</p>
                <p className="mt-1 font-display text-[1.7rem] leading-tight">{step}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </ScrollReveal>
        <ScrollReveal delay={120}>
          <EarningsExamples vehicles={catalogue} />
        </ScrollReveal>
      </section>

      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="max-w-2xl">
            <p className="kicker">The rules</p>
            <h2 className="mt-4 text-display-2">A commission on sales. Nothing else.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              You earn when a car is sold to someone you brought — the way commission has always worked in this trade, written down so
              nobody can bend it.
            </p>
          </ScrollReveal>
          <div className="mt-14">
            <PartnerRules />
          </div>
          <dl className="mt-16 grid gap-px border border-border-subtle bg-border-subtle md:grid-cols-3">
            {PARTNER_TERMS.map(([term, text]) => (
              <div key={term} className="bg-surface-1 p-6 md:p-8">
                <dt className="font-medium text-text-primary">{term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-14 border-t border-border-subtle pt-8 text-sm text-text-secondary">
            If anyone asks you to pay to join, or promises you money for signing people up, it is not Sabicars. Call{" "}
            <a href={`tel:${site.phones[0].e164}`} className="figures text-text-primary hover:text-accent-text">
              {site.phones[0].display}
            </a>{" "}
            to check.
          </p>
        </div>
      </section>

      <section id="register" className="scroll-mt-24 border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="kicker">Register</p>
            <h2 className="mt-4 text-display-2">Get your code.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              One minute, no fee. Your code and link appear as soon as you register.
            </p>
          </ScrollReveal>
          <PartnerForm />
        </div>
      </section>
    </>
  );
}
