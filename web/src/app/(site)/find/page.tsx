import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SourcingForm } from "@/components/forms/SourcingForm";
import { PageIntro } from "@/components/site/PageIntro";
import { mostRequested } from "@/lib/repositories/sourcing";
import { pageAddress, whatsappLink } from "@/lib/site";
import { BUDGET_OPTIONS } from "@/lib/sourcing";

export const metadata: Metadata = {
  title: "Request a car that is not in stock",
  description:
    "Can't find the car you want in stock? Tell Sabicars the vehicle, year and budget. Your request is recorded with a reference, and you are told the moment a match arrives.",
  ...pageAddress("/find"),
};

const STEPS = [
  ["Tell us", "The vehicle, the year, your budget, and how you would pay."],
  ["We keep your request", "You get a reference number, and your request goes on the list of cars we look for. If a car in stock already matches, you see it straight away."],
  ["You hear when it arrives", "When a matching car is listed, we tell you by WhatsApp, phone or email, as you choose."],
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * "Most requested right now". This page is rendered for each visitor (it reads
 * ?want= and ?budget= from the address), so the list comes from Next's data
 * cache and the database is asked at most every five minutes — the same
 * freshness the homepage gives it. Words and counts only, no Dates.
 */
const demandNow = unstable_cache(() => mostRequested(), ["most-requested"], { revalidate: 300 });

/**
 * Request a car (staff call it the Sourcing Desk).
 *
 * Its one job: turn "they don't have it" into a recorded request instead of a
 * lost buyer. Sabicars' audience is bigger than its showroom; this is where
 * the difference is kept. Arrives pre-filled from the homepage's first step.
 */
export default async function FindPage({ searchParams }: Props) {
  const sp = await searchParams;
  const want = first(sp.want)?.slice(0, 120);
  const budget = BUDGET_OPTIONS.some((b) => b.value === first(sp.budget)) ? first(sp.budget) : undefined;
  const demand = await demandNow();

  return (
    <>
      <PageIntro eyebrow="Request a car" title="Tell us the car you want.">
        <p>Can’t find it in our showroom? Tell us. You get a reference number, and we tell you as soon as a matching car arrives.</p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <ScrollReveal>
            <p className="kicker">How a request works</p>
            <ol className="mt-8 grid gap-8">
              {STEPS.map(([step, text], i) => (
                <li key={step} className="border-t border-green-700 pt-4">
                  <p className="figures text-xs text-text-muted">0{i + 1}</p>
                  <p className="mt-1 font-display text-[1.7rem] leading-tight">{step}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
                </li>
              ))}
            </ol>
          </ScrollReveal>

          {demand.length > 0 && (
            <ScrollReveal className="surface-card mt-12 p-6">
              <p className="text-sm font-medium text-text-muted">Most requested right now</p>
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
            Seen a car you like among the{" "}
            <Link href="/vehicles" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              cars for sale
            </Link>
            ? Use the form on that car’s page, so we know which car you mean. Selling a car instead?{" "}
            <Link href="/sell" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              Sell your car
            </Link>
            .
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
