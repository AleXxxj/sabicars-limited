import type { Metadata } from "next";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FleetForm } from "@/components/forms/FleetForm";
import { PageIntro } from "@/components/site/PageIntro";
import { categoryTiles } from "@/lib/repositories/vehicles";
import { pageAddress, site, whatsappLink } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Buy vehicles in bulk: fleet supply for companies and government",
  description:
    "Toyota Hiace buses, Coasters, SUVs, staff cars and trucks supplied in volume to companies and government bodies by Sabicars Limited (RC 1560100), Lagos.",
  ...pageAddress("/fleet"),
};

const SUPPLY = [
  ["Toyota Hiace buses", "Nigeria’s everyday bus, including the high-roof model people call the “Hummer”, which Sabicars is known for."],
  ["Coasters and larger buses", "For bigger groups, longer trips and staff buses for a whole organisation."],
  ["SUVs", "For senior staff, security teams and staff who work outside the city."],
  ["Staff and saloon cars", "Reliable cars for managers and staff, all of the same kind."],
  ["Pickups and trucks", "For moving goods, building work and jobs on site."],
];

const PROCESS = [
  ["Tell us what you need", "Which vehicles, how many, when, and where they are going."],
  ["We send the price", "A written price for each vehicle and for the whole order, ready for your organisation to approve."],
  ["We find and check them", "We find the vehicles, check them and prepare all the papers your organisation asks for."],
  ["We deliver", "Delivered in Lagos or elsewhere in Nigeria, with every document handed to you."],
];

/**
 * Buy in bulk (fleet and government supply): the channel where one
 * relationship is worth months of walk-ins. Specific past orders are not named
 * here until the business confirms which figures are accurate and which
 * clients may be named (architecture §8, item 15).
 */
export default async function FleetPage() {
  const tiles = await categoryTiles();
  const busCover = tiles.find((t) => t.key === "buses")?.coverUrl ?? null;

  return (
    <>
      <PageIntro eyebrow="Buy in bulk" title="Buying several vehicles? One order, one team." imageUrl={busCover}>
        <p>
          Companies and government offices buy several vehicles at once from Sabicars. We find them, check them, prepare the papers and
          deliver them as one order. One team looks after you from the first price to the day you get the keys.
        </p>
      </PageIntro>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
        <ScrollReveal className="max-w-2xl">
          <p className="kicker">What we supply</p>
          <h2 className="mt-4 text-display-2">From one bus to every vehicle your organisation needs.</h2>
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
            <p className="kicker">How a bulk order works</p>
            <h2 className="mt-4 text-display-2">Four steps. One team from start to finish.</h2>
          </ScrollReveal>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map(([step, text], i) => (
              <ScrollReveal as="li" key={step} delay={i * 90} className="border-t border-green-700 pt-5">
                <p className="figures text-xs text-text-muted">0{i + 1}</p>
                <p className="mt-2 font-display text-[1.7rem] leading-tight">{step}</p>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</p>
              </ScrollReveal>
            ))}
          </ol>
          <ScrollReveal className="mt-14 border-t border-border-subtle pt-8 text-sm text-text-secondary">
            Sabicars Limited is registered with the Corporate Affairs Commission under RC {site.rcNumber}.{" "}
            <a href={site.cacSearchUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text underline-offset-4 hover:underline">
              Your buying team can check it on the CAC register.
            </a>
          </ScrollReveal>
        </div>
      </section>

      <section id="quote" className="scroll-mt-24 border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ScrollReveal>
            <p className="kicker">Get a price</p>
            <h2 className="mt-4 text-display-2">Tell us what you need.</h2>
            <p className="mt-5 text-lg leading-relaxed text-text-secondary">
              You get a reference number. We will contact you to confirm exactly which vehicles you need, then send you a written price.
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
