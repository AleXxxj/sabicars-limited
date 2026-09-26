import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SourcingForm } from "@/components/forms/SourcingForm";
import { PageIntro } from "@/components/site/PageIntro";
import { mostRequested } from "@/lib/repositories/sourcing";
import { whatsappLink } from "@/lib/site";
import { BUDGET_OPTIONS } from "@/lib/sourcing";

export const metadata: Metadata = {
  title: "Find me a car — the Sourcing Desk",
  description:
    "Can't find the car you want in stock? Tell Sabicars the vehicle, year and budget. Your request is recorded with a reference, and you are told the moment a match arrives.",
  alternates: { canonical: "/find" },
};

const STEPS = [
  ["Tell us", "The vehicle, the year, your budget, and how you would pay."],
  ["It goes on record", "Your request gets a reference and joins the list Sabicars sources from. If something in stock already matches, you see it straight away."],
  ["You hear when it arrives", "When a vehicle that matches is listed, you are told — by WhatsApp, phone or email, as you choose."],
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The Sourcing Desk.
 *
 * Its one job: turn "they don't have it" into a recorded request instead of a
 * lost buyer. Sabicars' audience is bigger than its showroom; this is where
 * the difference is kept. Arrives pre-filled from the homepage's first step.
 */
export default async function FindPage({ searchParams }: Props) {
  const sp = await searchParams;
  const want = first(sp.want)?.slice(0, 120);
  const budget = BUDGET_OPTIONS.some((b) => b.value === first(sp.budget)) ? first(sp.budget) : undefined;
  const demand = await mostRequested();

  return (
    <>
      <PageIntro eyebrow="The Sourcing Desk" title="Tell us the car you want.">
        <p>
          If it isn’t in the showroom today, your request goes on record with a reference — and you are told the moment a vehicle that
          matches arrives.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <ScrollReveal>
            <p className="eyebrow">How the desk works</p>
            <ol className="mt-8 grid gap-8">
              {STEPS.map(([step, text], i) => (
                <li key={step} className="border-t border-gold-700 pt-4">
                  <p className="figures text-xs text-text-muted">0{i + 1}</p>
                  <p className="mt-1 font-display text-[1.7rem] leading-tight">{step}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
                </li>
              ))}
            </ol>
          </ScrollReveal>

          {demand.length > 0 && (
            <ScrollReveal className="mt-12 border border-border-subtle p-6">
              <p className="eyebrow !text-text-muted">Most requested right now</p>
              <ul className="mt-4 divide-y divide-border-subtle">
                {demand.map((d) => (
                  <li key={d.want} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className="text-text-primary">{d.want}</span>
                    <span className="figures shrink-0 text-sm text-text-muted">
                      {d.requests} {d.requests === 1 ? "request" : "requests"}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          )}

          <p className="mt-12 text-sm text-text-muted">
            Seen a car you like in the{" "}
            <Link href="/vehicles" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              inventory
            </Link>
            ? Enquire on its page — it tells us exactly which one you mean.
          </p>
        </div>

        {/* Arriving from the homepage's first step, the visitor is mid-task: on a phone, the form comes before the explanation. */}
        <div className={want ? "order-first lg:order-none" : undefined}>
          <SourcingForm whatsappBase={whatsappLink()} initial={{ want, budget }} />
        </div>
      </section>
    </>
  );
}
