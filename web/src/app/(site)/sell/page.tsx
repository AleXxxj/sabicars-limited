import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SellForm } from "@/components/forms/SellForm";
import { PageIntro } from "@/components/site/PageIntro";
import { listedVehicles } from "@/lib/repositories/vehicles";
import { SELL_INTENTS, type SellIntent } from "@/lib/sell";
import { pageAddress, whatsappLink } from "@/lib/site";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = {
  title: "Sell or trade in your car in Lagos",
  description:
    "Selling a car in Lagos? Tell Sabicars about it: sell it to us, trade it in for one of our cars, or have us sell it for you. Recorded with a reference, and we never charge to look at your car.",
  ...pageAddress("/sell"),
};

const STEPS = [
  ["Tell us about the car", "The make, model and year, its condition and papers, and a price if you have one in mind."],
  ["Send a few photos", "On WhatsApp, with your reference: the outside, the dashboard with the engine running, and the papers."],
  ["We come back to you", "With what we can do: buy it, take it in exchange for one of ours, or sell it for you. Nothing is final until we have seen the car."],
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Sell or trade in.
 *
 * Its one job: bring cars in. Sabicars' stock is its limit, and the people
 * who buy from it also own cars. Every offer is recorded with a reference,
 * like every other enquiry, so none is lost in one person's phone.
 */
export default async function SellPage({ searchParams }: Props) {
  const sp = await searchParams;
  const asked = Array.isArray(sp.intent) ? sp.intent[0] : sp.intent;
  const initialIntent: SellIntent = asked && asked in SELL_INTENTS ? (asked as SellIntent) : "sell";
  const stock = (await listedVehicles()).filter((v) => v.status === "available").map((v) => ({ id: v.id, title: vehicleTitle(v), price: priceLabel(v) }));

  return (
    <>
      <PageIntro eyebrow="Sell or trade in" title="Selling a car? Start with Sabicars.">
        <p>Sell it to us, trade it in for one of our cars, or have us sell it for you. Tell us about it here, and it is on record with a reference.</p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-14 px-5 py-16 md:px-10 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <ScrollReveal>
            <p className="kicker">How it works</p>
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

          <div className="surface-card mt-12 p-6 text-sm leading-relaxed text-text-secondary">
            <p className="font-semibold text-text-primary">Sabicars never charges to look at your car.</p>
            <p className="mt-2">
              Anyone who asks for an inspection fee, a deposit or a &ldquo;registration&rdquo; payment to buy your car in our name is not us.
              Our only numbers are on the{" "}
              <Link href="/contact" className="text-link underline underline-offset-2">
                contact page
              </Link>
              .
            </p>
          </div>

          <p className="mt-12 text-sm text-text-muted">
            Buying instead? See the{" "}
            <Link href="/vehicles" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              inventory
            </Link>
            , or tell the{" "}
            <Link href="/find" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              Sourcing Desk
            </Link>{" "}
            the car you want.
          </p>
        </div>

        <SellForm whatsappBase={whatsappLink()} stock={stock} initialIntent={initialIntent} />
      </section>
    </>
  );
}
