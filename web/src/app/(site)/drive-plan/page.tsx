import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CarFront, FileSignature, KeyRound } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { DrivePlanFinder } from "@/components/home/DrivePlanFinder";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageIntro } from "@/components/site/PageIntro";
import { VehicleImage } from "@/components/VehicleImage";
import { drivePlanCatalogue, featuredVehicles } from "@/lib/repositories/vehicles";
import { whatsappLink } from "@/lib/site";
import { drivePlanBalance, drivePlanDeposit, priceLabel, vehicleTitle } from "@/lib/vehicle";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The 40% Drive Plan — pay 40%, Autochek finances the rest",
  description:
    "Buy from Sabicars with 40% down. Autochek, Sabicars' financing partner, finances the remaining 60% on its own terms. See what your deposit can drive home from live stock.",
  alternates: { canonical: "/drive-plan" },
};

const STEPS = [
  { icon: CarFront, title: "Choose your vehicle", text: "In the showroom or online. Every price already shows the 40% deposit and the 60% Autochek finances." },
  { icon: FileSignature, title: "Apply on Autochek", text: "From the vehicle’s page, go to its listing on Sabicars’ Autochek dealer store. Autochek profiles you there." },
  { icon: BadgeCheck, title: "Autochek approves", text: "The loan terms — tenor and interest — are already set on the listing. Autochek processes and approves the financing." },
  { icon: KeyRound, title: "Pay 40% and drive", text: "Once approved, you pay the 40% deposit, take the keys, and repay the 60% to Autochek in instalments." },
];

const QUESTIONS = [
  ["When can I drive it home?", "As soon as Autochek approves the financing. You pay the 40% deposit then, and the car leaves the showroom with you — it does not leave before approval."],
  ["Who finances the 60%?", "Autochek, Sabicars’ financing partner for the Drive Plan. The balance is an Autochek facility, on Autochek’s terms — Sabicars does not lend."],
  ["Can I find Sabicars cars on Autochek?", "Yes. Sabicars’ stock is also listed on its Autochek dealer store. Wherever you find the car, the loan is profiled and processed by Autochek."],
  ["What if the car I want is not on Autochek?", "Press “Apply for the Drive Plan” on its page. Sabicars lists it on its Autochek store and sends you the link."],
  ["What will I need?", "Autochek tells you exactly what it needs when you apply. Have a valid ID and your recent bank statements ready; they are what a lender asks for first."],
  ["Can I pay the full price instead?", "Yes. Every vehicle can be bought outright, and the finder above shows which ones your amount already covers."],
  ["Can I see the car before I apply?", "Please do. Walk in, inspect it, and apply once you are sure — the application is about the car you have chosen."],
];

/**
 * The 40% Drive Plan.
 *
 * Its one job: get a buyer who cannot pay all of it to a car they can apply
 * for. As the owner described it: Sabicars' stock is listed on its Autochek
 * dealer store; loan buyers are profiled and processed by Autochek, and each
 * listing already carries its loan configuration. The car leaves the
 * showroom only once Autochek has approved (confirmed by the owner, 2026-09-26).
 * Applications therefore
 * start from a vehicle's page (DrivePlanApply), which records the buyer and
 * sends them to that car's listing. No tenor or rate is published here —
 * Autochek sets them per listing.
 */
export default async function DrivePlanPage() {
  const [catalogue, featured] = await Promise.all([drivePlanCatalogue(), featuredVehicles(6)]);
  const example = featured.find((v) => v.priceMinor && v.segment !== "commercial" && v.cover) ?? featured.find((v) => v.priceMinor);

  return (
    <>
      <PageIntro eyebrow="The 40% Drive Plan" title="Pay 40%. Autochek finances the rest." imageUrl={example?.cover?.url ?? null}>
        <p>Choose any vehicle, put down 40% of the price, and Autochek — Sabicars’ financing partner — finances the remaining 60%.</p>
      </PageIntro>

      {catalogue.length > 0 && (
        <section id="finder" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <DrivePlanFinder vehicles={catalogue}>
              <ScrollReveal>
                <p className="kicker">Start here</p>
                <h2 className="mt-4 text-display-2">What can your 40% drive home?</h2>
                <p className="mt-5 text-lg leading-relaxed text-text-secondary">
                  Type what you can put down. The answer comes from what is in the showroom right now.
                </p>
              </ScrollReveal>
            </DrivePlanFinder>
          </div>
        </section>
      )}

      <section className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="max-w-2xl">
            <p className="kicker">How it works</p>
            <h2 className="mt-4 text-display-2">Four steps from choosing to driving.</h2>
          </ScrollReveal>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <ScrollReveal as="li" key={title} delay={i * 80} className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                    <Icon aria-hidden size={20} strokeWidth={1.75} />
                  </span>
                  <span className="figures text-sm text-text-muted">0{i + 1}</span>
                </div>
                <p className="mt-4 text-[1.1rem] font-semibold text-text-primary">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
              </ScrollReveal>
            ))}
          </ol>

          {example && (
            <ScrollReveal className="mt-10">
              <Link href={`/vehicles/${example.slug}`} className="surface-card group grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                {example.cover && (
                  <div className="relative aspect-[16/10] md:aspect-auto">
                    <VehicleImage src={example.cover.url} alt={vehicleTitle(example)} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
                  </div>
                )}
                <div className="p-6 md:p-10">
                  <p className="text-sm font-medium text-text-muted">For example</p>
                  <p className="mt-1 text-[1.5rem] font-semibold leading-tight text-text-primary group-hover:text-gold-200">{vehicleTitle(example)}</p>
                  <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-5">
                    <div>
                      <dt className="text-xs text-text-muted">Price</dt>
                      <dd className="figures mt-1 font-semibold">{priceLabel(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">You pay (40%)</dt>
                      <dd className="figures mt-1 font-semibold text-accent-text">{drivePlanDeposit(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Autochek (60%)</dt>
                      <dd className="figures mt-1 font-semibold">{drivePlanBalance(example)}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </ScrollReveal>
          )}
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[linear-gradient(180deg,var(--surface-1),transparent)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="kicker">Good to know</p>
            <h2 className="mt-4 text-display-2">Straight answers.</h2>
          </ScrollReveal>
          <div className="grid gap-3">
            {QUESTIONS.map(([q, a]) => (
              <details key={q} className="surface-card group p-5 md:p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.05rem] font-semibold text-text-primary">
                  <span>{q}</span>
                  <span aria-hidden className="text-gold-300 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-text-secondary">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="apply" className="scroll-mt-24 border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="kicker">Questions first?</p>
            <h2 className="mt-4 text-display-2">Ask before you apply.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              Applications start from the vehicle you choose — use the finder above, or{" "}
              <Link href="/vehicles" className="text-gold-300 underline-offset-4 hover:underline">
                browse the inventory
              </Link>
              , then press “Apply” on its page. Anything you want to know first, ask here: it is recorded with a reference.
            </p>
          </ScrollReveal>
          <ContactForm
            whatsappBase={whatsappLink()}
            defaultTopic="drive_plan"
            messagePlaceholder="Which vehicle are you considering, and what would you like to know?"
          />
        </div>
      </section>
    </>
  );
}
