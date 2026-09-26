import type { Metadata } from "next";
import { BadgeCheck, Eye, Truck, Wallet } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { formatNaira, money, percentOf } from "@/lib/money";
import { hummerBuses } from "@/lib/repositories/vehicles";
import { DRIVE_PLAN_DEPOSIT_BPS } from "@/lib/vehicle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Toyota Hiace Hummer bus for sale in Lagos",
  description:
    "Toyota Hiace Hummer (Humer) buses for sale in Lagos from Sabicars Limited — in stock, inspected, priced, supplied as fleets, and available on the 40% Drive Plan with Autochek.",
  alternates: { canonical: "/hummer-bus" },
};

const WHY = [
  { icon: BadgeCheck, title: "What Sabicars is known for", text: "Hummer buses are Sabicars’ speciality — the vehicle the business built its name on." },
  { icon: Eye, title: "See it before you pay", text: "Every bus here is in stock. Walk in, sit in it, start it, and inspect it before any money moves." },
  { icon: Truck, title: "One bus or a whole fleet", text: "Staff transport, schools, churches, hotels, routes — one quotation and one accountable team for any number." },
  { icon: Wallet, title: "Pay 40%", text: "Put down 40% and drive it home the same day, while Autochek, Sabicars’ financing partner, finances the rest." },
];

/**
 * The Hummer bus — the Toyota Hiace high-roof, Sabicars' signature vehicle.
 *
 * Its one job: be the page Nigeria finds when it searches for a Hummer bus,
 * and turn that search into a viewing, a Drive Plan application or a fleet
 * quotation. The name is spelt the way the market searches ("Hummer"), with
 * the "Humer" of some listings covered in the description.
 */
export default async function HummerBusPage() {
  const buses = await hummerBuses();
  const hummers = buses.filter((b) => /hum+er/i.test(b.model));
  // Prices quoted for the Hummers themselves; the older short Hiace would understate them.
  const priced = (hummers.length ? hummers : buses).filter((b) => b.priceMinor).sort((a, b) => a.priceMinor! - b.priceMinor!);
  const cover = hummers.find((b) => b.cover)?.cover?.url ?? buses.find((b) => b.cover)?.cover?.url ?? null;
  const from = priced[0]?.priceMinor ?? null;

  return (
    <>
      <PageIntro eyebrow="The Hummer bus specialists" title="The Toyota Hiace Hummer bus." imageUrl={cover}>
        <p>
          The high-roof Hiace Nigeria calls the Hummer bus — for staff transport, schools, churches, hotels and commercial routes.
          Sabicars keeps them in stock, supplies them as fleets, and puts them on the 40% Drive Plan.
        </p>
      </PageIntro>

      <section aria-label="At a glance" className="relative z-10 -mt-10 md:-mt-14">
        <dl className="mx-auto grid max-w-7xl grid-cols-3 gap-3 px-5 md:gap-4 md:px-10">
          {[
            [String(hummers.length || buses.length), hummers.length === 1 ? "Hummer bus in stock" : "Hummer buses in stock"],
            [from ? formatNaira(from, { compact: true }) : "—", "Starting price"],
            [from ? formatNaira(percentOf(money(from, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor, { compact: true }) : "—", "Lowest 40% deposit"],
          ].map(([value, label]) => (
            <div key={label} className="glass rounded-2xl p-4 md:p-6">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="figures block font-display text-[1.9rem] leading-none md:text-[2.75rem]">{value}</span>
                <span className="mt-2 block text-[0.8rem] leading-snug text-text-secondary">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">In stock now</p>
            <h2 className="mt-4 text-display-2">Every Hummer in the showroom.</h2>
          </div>
          <ButtonLink href="/find?want=Toyota+Hiace+Hummer+bus" variant="quiet">
            Want a particular year? Tell us
          </ButtonLink>
        </ScrollReveal>
        {buses.length ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {buses.map((v, i) => (
              <ScrollReveal key={v.id} delay={(i % 3) * 80}>
                <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <div className="surface-card mt-12 p-8 text-center">
            <p className="text-lg text-text-primary">Every Hummer bus has just been sold.</p>
            <p className="mt-2 text-text-secondary">Put one on the Sourcing Desk and you will hear the moment the next one arrives.</p>
            <ButtonLink href="/find?want=Toyota+Hiace+Hummer+bus" className="mt-6">
              Find me a Hummer bus
            </ButtonLink>
          </div>
        )}
      </section>

      <section className="border-t border-white/[0.06] bg-[linear-gradient(180deg,var(--surface-1),transparent)]">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="max-w-2xl">
            <p className="kicker">Why buy it here</p>
            <h2 className="mt-4 text-display-2">The home of the Hummer bus.</h2>
          </ScrollReveal>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(({ icon: Icon, title, text }, i) => (
              <ScrollReveal as="li" key={title} delay={i * 80} className="surface-card p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                  <Icon aria-hidden size={20} strokeWidth={1.75} />
                </span>
                <p className="mt-4 text-[1.1rem] font-semibold text-text-primary">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
              </ScrollReveal>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap gap-3">
            <ButtonLink href="/fleet#quote" size="lg">
              Quote me a fleet
            </ButtonLink>
            <ButtonLink href="/drive-plan" size="lg" variant="secondary">
              How the Drive Plan works
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
