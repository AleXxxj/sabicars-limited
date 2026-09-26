import type { Metadata } from "next";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FleetForm } from "@/components/forms/FleetForm";
import { PageIntro } from "@/components/site/PageIntro";
import { categoryTiles } from "@/lib/repositories/vehicles";
import { site, whatsappLink } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Fleet & government vehicle supply",
  description:
    "Toyota Hiace buses, Coasters, SUVs, staff cars and trucks supplied in volume to companies and government bodies by Sabicars Limited (RC 1560100), Lagos.",
  alternates: { canonical: "/fleet" },
};

const SUPPLY = [
  ["Toyota Hiace buses", "The workhorse of Nigerian transport — including the high-roof models the market calls “Hummer”, which Sabicars is known for."],
  ["Coasters and larger buses", "For larger groups, longer routes and organisation-wide staff transport."],
  ["SUVs", "For executives, security details and teams that work outside the city."],
  ["Staff and saloon cars", "Dependable cars for managers and staff, supplied as a matched set."],
  ["Pickups and trucks", "For logistics, construction and field operations."],
];

const PROCESS = [
  ["The brief", "Tell us what you need: which vehicles, how many, when, and where they are going."],
  ["The quotation", "A written, itemised quotation — per vehicle and in total — for your procurement process."],
  ["Sourcing and papers", "Vehicles sourced, checked and documented, with the paperwork your organisation requires."],
  ["Delivery and handover", "Delivered in Lagos or elsewhere in Nigeria, and handed over with every document."],
];

/**
 * Fleet and government supply: the channel where one relationship is worth
 * months of walk-ins. Specific past orders are not named here until the
 * business confirms which figures are accurate and which clients may be named
 * (architecture §8, item 15).
 */
export default async function FleetPage() {
  const tiles = await categoryTiles();
  const busCover = tiles.find((t) => t.label === "Buses & Hiace")?.coverUrl ?? null;

  return (
    <>
      <PageIntro eyebrow="Fleet & Government" title="One supplier for the whole fleet." imageUrl={busCover}>
        <p>
          Companies and government bodies buy from Sabicars in volume — sourced, documented and delivered as a single order, with one
          team accountable from quotation to handover.
        </p>
      </PageIntro>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
        <ScrollReveal className="max-w-2xl">
          <p className="eyebrow">What we supply</p>
          <h2 className="mt-4 text-display-2">From a single bus to an organisation’s entire fleet.</h2>
        </ScrollReveal>
        <ul className="mt-14 divide-y divide-border-subtle border-y border-border-subtle">
          {SUPPLY.map(([name, text], i) => (
            <ScrollReveal as="li" key={name} delay={i * 60} className="grid gap-2 py-6 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-10">
              <p className="font-display text-[1.7rem] leading-tight">{name}</p>
              <p className="leading-relaxed text-text-secondary md:pt-1">{text}</p>
            </ScrollReveal>
          ))}
        </ul>
      </section>

      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="max-w-2xl">
            <p className="eyebrow">How a fleet order works</p>
            <h2 className="mt-4 text-display-2">Four steps, one accountable team.</h2>
          </ScrollReveal>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map(([step, text], i) => (
              <ScrollReveal as="li" key={step} delay={i * 90} className="border-t border-gold-700 pt-5">
                <p className="figures text-xs text-text-muted">0{i + 1}</p>
                <p className="mt-2 font-display text-[1.7rem] leading-tight">{step}</p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</p>
              </ScrollReveal>
            ))}
          </ol>
          <ScrollReveal className="mt-14 border-t border-border-subtle pt-8 text-sm text-text-secondary">
            Sabicars Limited is registered with the Corporate Affairs Commission under RC {site.rcNumber}.{" "}
            <a href={site.cacSearchUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text underline-offset-4 hover:underline">
              Your procurement team can verify it on the CAC register.
            </a>
          </ScrollReveal>
        </div>
      </section>

      <section id="quote" className="scroll-mt-24 border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="eyebrow">Request a quotation</p>
            <h2 className="mt-4 text-display-2">Tell us what the fleet needs.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              Your request is recorded with a reference. Sabicars will contact you to confirm the specification and prepare the
              quotation.
            </p>
            <p className="figures mt-8 text-sm text-text-muted">
              Or call{" "}
              <a href={`tel:${site.phones[0].e164}`} className="text-text-primary">
                {site.phones[0].display}
              </a>
            </p>
          </ScrollReveal>
          <FleetForm whatsappBase={whatsappLink()} />
        </div>
      </section>
    </>
  );
}
