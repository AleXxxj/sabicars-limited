import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CarFront, FileSignature, KeyRound } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { DrivePlanFinder } from "@/components/home/DrivePlanFinder";
import { PriceSplit } from "@/components/home/PriceSplit";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageIntro } from "@/components/site/PageIntro";
import { VehicleImage } from "@/components/VehicleImage";
import { DEFAULT_ESTIMATE_MONTHS, DRIVE_PLAN, MONTHLY_INCLUDES, depositMinorFor, drivePlanTerms } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";
import { drivePlanCatalogue, featuredVehicles } from "@/lib/repositories/vehicles";
import { pageAddress, whatsappLink } from "@/lib/site";
import { drivePlanBalance, drivePlanDeposit, drivePlanMonthly, priceLabel, vehicleTitle } from "@/lib/vehicle";

export const revalidate = 3600;

const { minYear, standardYear, statementMonths, statementAlternative, maxAnnualRatePercent, tenureMonths, maxDepositBps, published } = DRIVE_PLAN;
const olderYears = `${minYear} or ${standardYear - 1}`;

export const metadata: Metadata = {
  title: "The 40% Drive Plan — your deposit down, Autochek finances the rest",
  description: `Buy from Sabicars with 40% down on a car from ${standardYear} (50% on a ${olderYears} car). Autochek, Sabicars' financing partner, finances the rest: up to ${maxAnnualRatePercent}% a year, over ${tenureMonths.min} to ${tenureMonths.max} months. What you need, and what your deposit reaches from live stock, with an estimated monthly repayment at Autochek's ${maxAnnualRatePercent}% ceiling.`,
  ...pageAddress("/drive-plan"),
};

const STEPS = [
  {
    icon: CarFront,
    title: "Choose your vehicle",
    text: `In the showroom or online. Each car shows its deposit: 40% for a car from ${standardYear} or newer, 50% for a ${olderYears} car. It also shows what the loan covers.`,
  },
  {
    icon: FileSignature,
    title: "Apply on Autochek",
    text: "From the vehicle’s page, go to its listing on Sabicars’ Autochek dealer store. You pre-qualify in minutes; Autochek’s lenders then assess you.",
  },
  {
    icon: BadgeCheck,
    title: "The lender approves",
    text: `The lender sets the rate and the term when it assesses you — up to ${maxAnnualRatePercent}% a year, over ${tenureMonths.min} to ${tenureMonths.max} months — and sends an offer, usually within ${published.offerWithin}.`,
  },
  {
    icon: KeyRound,
    title: "Pay your deposit and drive",
    text: "Once approved, you pay the deposit and take the keys. Then you repay the rest through Autochek in monthly instalments.",
  },
];

/** What Autochek asks of the car. */
const CAR_RULES: [string, string][] = [
  [`${standardYear} or newer`, "40% down. A loan covers 60%."],
  [olderYears, "50% down. A loan covers 50%."],
  [`${minYear - 1} or older`, "No loan. You pay the full price."],
];

/** What Autochek asks of the buyer. */
const DOCUMENTS: [string, string][] = [
  ["BVN and a valid ID", "A national ID card, driver’s licence, passport or voter’s card."],
  [
    "Bank statements",
    `The last ${statementMonths} months from the account you actually use — a commercial bank, or ${statementAlternative} — showing money coming in and going out. Autochek reads them digitally when you apply.`,
  ],
  ["Proof of income", "Salary earners: an employment letter or recent payslips. Business owners: a CAC business registration — a registered business name is enough."],
  ["A utility bill", "For the address you give."],
];

const QUESTIONS: [string, string][] = [
  [
    "When can I drive it home?",
    "As soon as Autochek’s lender approves the financing and your deposit is paid. The car leaves the showroom with you then — it does not leave before approval.",
  ],
  [
    "Who lends the rest of the price?",
    "Lenders who work with Autochek, our finance partner. The loan for the rest of the price is theirs, on their terms. Sabicars does not lend money.",
  ],
  [
    "What is the interest rate?",
    `The lender sets it when it assesses you, and you see it in your offer before you commit to anything. Autochek publishes a ceiling of ${maxAnnualRatePercent}% a year over ${tenureMonths.min} to ${tenureMonths.max} months; on its listings the rate is “available on request”. Autochek’s own example: ${formatNaira(published.example.principalMinor)} over ${published.example.months} months at ${maxAnnualRatePercent}% a year is about ${formatNaira(published.example.monthlyMinor)} a month. Every monthly figure on this site is an estimate at that ceiling over the term you pick, so you can plan; your offer can be lower.`,
  ],
  [
    "Why is the deposit 50% on some cars?",
    `Autochek’s lenders ask for 50% on a ${olderYears} car and 40% on anything from ${standardYear}. Cars older than ${minYear} cannot get a loan, so you pay for them in full. The finder above only shows cars that can go on the plan.`,
  ],
  [
    "I don’t have a registered business. Can I still apply?",
    "Business owners need a CAC registration, and a registered business name is enough. You can register one yourself at pre.cac.gov.ng for the CAC’s published fee (about ₦21,700 in 2026), usually within a few working days. Autochek’s team told Sabicars in October 2026 that it can arrange one for about ₦35,000 — ask when you apply.",
  ],
  [
    "Are there fees?",
    `Autochek charges a processing fee (its published example is ${formatNaira(published.processingFeeMinor)}), credited against your final payment if the loan goes through. The monthly repayment on the car’s Autochek listing includes ${MONTHLY_INCLUDES}; the estimates on this site are the loan alone.`,
  ],
  ["Can I put down more than the minimum?", `Yes, up to ${maxDepositBps / 100}% of the price. Pay more now and you borrow less, so each monthly payment is smaller.`],
  [
    "Can I find Sabicars cars on Autochek?",
    "Yes. Sabicars’ stock is also listed on its Autochek dealer store. Wherever you find the car, Autochek’s lenders check and approve the loan.",
  ],
  ["What if the car I want is not on Autochek?", "Press “Apply for the Drive Plan” on its page. Sabicars lists it on its Autochek store and sends you the link."],
  ["Can I pay the full price instead?", "Yes. You can pay the full price for any vehicle. The finder above shows which ones your amount already covers."],
  ["Can I see the car before I apply?", "Please do. Walk in, inspect it, and apply once you are sure — the application is about the car you have chosen."],
];

/**
 * The 40% Drive Plan.
 *
 * Its one job: get a buyer who cannot pay all of it to a car they can apply
 * for. Sabicars' stock is listed on its Autochek dealer store; loan buyers
 * are assessed by Autochek's lenders, and the car leaves the showroom only
 * once a lender has approved (confirmed by the owner, 2026-09-26).
 *
 * The rules on this page — the deposit by model year, the documents, the
 * rate ceiling and the fees — are what Autochek's team told Sabicars on
 * 2026-10-20 and what Autochek publishes; they live in lib/drive-plan.ts.
 * Autochek's own listings show "40% minimum" on every car, including cars
 * older than 2008, so the stricter year tiers are stated here as the lenders'
 * rule, which is the one a buyer will meet. Every monthly figure is an
 * estimate at Autochek's published ceiling over the term the buyer picks and
 * is labelled so (lib/drive-plan.ts monthlyAtCeilingMinor); Autochek's
 * published example is quoted as its own.
 */
export default async function DrivePlanPage() {
  const [catalogue, featured] = await Promise.all([drivePlanCatalogue(), featuredVehicles(6)]);
  const onPlan = featured.filter((v) => depositMinorFor(v.priceMinor, v.year) !== null);
  const example = onPlan.find((v) => v.segment !== "commercial" && v.cover) ?? onPlan[0];
  const exampleTerms = example ? drivePlanTerms(example.year) : null;
  const exampleMonthly = example ? drivePlanMonthly(example) : null;

  return (
    <>
      <PageIntro eyebrow="The 40% Drive Plan" title="Pay 40% down. Pay the rest monthly." imageUrl={example?.cover?.url ?? null}>
        <p>
          Choose a car from {standardYear} or newer and pay 40% of the price. A loan through Autochek, our finance partner, covers the other 60%
          if its lender approves you. You repay it monthly. For a {olderYears} car, you pay 50%.
        </p>
      </PageIntro>

      {catalogue.length > 0 && (
        <section id="finder" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <DrivePlanFinder vehicles={catalogue}>
              <ScrollReveal>
                <p className="kicker">Start here</p>
                <h2 className="mt-4 text-display-2">What can your deposit drive home?</h2>
                <p className="mt-5 text-lg leading-relaxed text-text-secondary">
                  Type what you can put down. The answer comes from what is in the showroom right now, each car at its own deposit.
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
                  <span className="inline-flex size-11 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10 text-green-300">
                    <Icon aria-hidden size={20} strokeWidth={1.75} />
                  </span>
                  <span className="figures text-sm text-text-muted">0{i + 1}</span>
                </div>
                <p className="mt-4 text-[1.1rem] font-semibold text-text-primary">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
              </ScrollReveal>
            ))}
          </ol>

          {example && exampleTerms?.eligible && (
            <ScrollReveal className="mt-10">
              <Link href={`/vehicles/${example.slug}`} className="surface-card group grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                {example.cover && (
                  <div className="relative aspect-[16/10] md:aspect-auto">
                    <VehicleImage src={example.cover.url} alt={vehicleTitle(example)} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
                  </div>
                )}
                <div className="p-6 md:p-10">
                  <p className="text-sm font-medium text-text-muted">For example</p>
                  <p className="mt-1 text-[1.5rem] font-semibold leading-tight text-text-primary group-hover:text-green-200">{vehicleTitle(example)}</p>
                  <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-5">
                    <div>
                      <dt className="text-xs text-text-muted">Price</dt>
                      <dd className="figures mt-1 font-semibold">{priceLabel(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">You pay ({exampleTerms.depositPercent}%)</dt>
                      <dd className="figures mt-1 font-semibold text-accent-text">{drivePlanDeposit(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Autochek ({exampleTerms.financedPercent}%)</dt>
                      <dd className="figures mt-1 font-semibold">{drivePlanBalance(example)}</dd>
                      {exampleMonthly && (
                        <dd className="figures mt-1 text-xs text-text-muted">
                          est. {exampleMonthly} a month for {DEFAULT_ESTIMATE_MONTHS} months
                        </dd>
                      )}
                    </div>
                  </dl>
                </div>
              </Link>
            </ScrollReveal>
          )}

          {catalogue.length > 0 && (
            <ScrollReveal className="mt-10">
              <PriceSplit vehicles={catalogue} />
            </ScrollReveal>
          )}
        </div>
      </section>

      <section id="eligibility" className="scroll-mt-24 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="max-w-2xl">
            <p className="kicker">Who qualifies</p>
            <h2 className="mt-4 text-display-2">The car, and what to bring.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              Autochek’s lenders look at the car first, then at you. Have these ready and the application takes minutes.
            </p>
          </ScrollReveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <ScrollReveal className="surface-card p-6 md:p-8">
              <p className="text-sm font-semibold text-text-primary">The car</p>
              <dl className="mt-4 divide-y divide-border-subtle">
                {CAR_RULES.map(([years, rule]) => (
                  <div key={years} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                    <dt className="figures font-semibold text-text-primary">{years}</dt>
                    <dd className="text-text-secondary">{rule}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-text-muted">You may put down more than the minimum, up to {maxDepositBps / 100}% of the price.</p>
            </ScrollReveal>
            <ScrollReveal delay={80} className="surface-card p-6 md:p-8">
              <p className="text-sm font-semibold text-text-primary">You</p>
              <dl className="mt-4 divide-y divide-border-subtle">
                {DOCUMENTS.map(([what, detail]) => (
                  <div key={what} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                    <dt className="font-semibold text-text-primary">{what}</dt>
                    <dd className="text-text-secondary">{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-text-muted">
                No CAC registration yet? A business name can be registered in a few working days — see the questions below.
              </p>
            </ScrollReveal>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-text-muted">
            The deposit tiers, the year floor and the bank-app statements are as Autochek’s team gave them to Sabicars on 20 October 2026; the rate
            ceiling, the terms, the documents and the fee are as Autochek publishes. Its lenders decide each application and may ask for more.
            Sabicars updates this page when Autochek’s terms change.
          </p>
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
                  <span aria-hidden className="text-green-300 transition-transform group-open:rotate-45">+</span>
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
              Every application starts from one car. Find it with the finder above or in the{" "}
              <Link href="/vehicles" className="text-green-300 underline-offset-4 hover:underline">
                cars for sale
              </Link>
              , then press “Apply” on its page. Ask here and you get a reference number.
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
