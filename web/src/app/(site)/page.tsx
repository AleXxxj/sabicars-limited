import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Address } from "@/components/site/Address";
import { VehicleCard } from "@/components/VehicleCard";
import { VehicleImage } from "@/components/VehicleImage";
import { HeroShowcase, type HeroSlide } from "@/components/home/HeroShowcase";
import { ButtonLink } from "@/components/ui/Button";
import { categoryTiles, featuredVehicles, heroVehicles, heroVideoUrl, inventoryStats } from "@/lib/repositories/vehicles";
import { formatNaira } from "@/lib/money";
import { dealerJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { site, siteUrl } from "@/lib/site";
import { drivePlanBalance, drivePlanDeposit, priceLabel, vehicleTitle } from "@/lib/vehicle";

/**
 * Rebuilt every five minutes, and immediately whenever staff change a vehicle
 * (the admin's actions revalidate "/"), so the homepage never shows stock that
 * has gone.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Sabicars — Verified Luxury Cars, Toyota Hiace Buses & Trucks in Lagos" },
  alternates: { canonical: "/" },
};

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-display-2">{title}</h2>
      {children && <div className="mt-5 text-lg leading-relaxed text-text-secondary">{children}</div>}
    </div>
  );
}

export default async function Home() {
  const [hero, featured, stats, tiles, videoUrl] = await Promise.all([heroVehicles(8), featuredVehicles(6), inventoryStats(), categoryTiles(), heroVideoUrl()]);

  // Staff choose hero vehicles; if none are chosen, lead with featured stock
  // rather than an empty backdrop.
  const heroSource = (hero.length ? hero : featured).filter((v) => v.cover);
  const slides: HeroSlide[] = heroSource.map((v) => ({ url: v.cover!.url, title: vehicleTitle(v), price: priceLabel(v), href: `/vehicles/${v.slug}` }));

  // A real vehicle to explain the Drive Plan with, rather than invented numbers.
  const example = featured.find((v) => v.priceMinor && v.segment !== "commercial") ?? featured.find((v) => v.priceMinor);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@graph": [dealerJsonLd(), { "@type": "WebSite", "@id": `${siteUrl()}/#website`, url: siteUrl(), name: site.legalName, publisher: { "@id": `${siteUrl()}/#dealer` } }],
          }),
        }}
      />

      <HeroShowcase slides={slides} videoUrl={videoUrl} />

      {/* Facts, live from the inventory. */}
      <section aria-label="At a glance" className="border-b border-border-subtle bg-surface-1">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border-subtle md:grid-cols-4">
          {[
            [String(stats.inStock), "Vehicles in stock today"],
            [String(stats.makes), "Makes, from Toyota to Mercedes-Benz"],
            [stats.fromMinor ? formatNaira(stats.fromMinor, { compact: true }) : "—", "Starting price"],
            [site.rcNumber, "RC number · registered with the CAC"],
          ].map(([value, label]) => (
            <div key={label} className="bg-surface-1 px-5 py-7 md:px-10 md:py-9">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="figures block font-display text-[2.4rem] leading-none text-text-primary md:text-[3rem]">{value}</span>
                <span className="mt-2 block text-sm text-text-muted">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Ways in. */}
      {tiles.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal>
            <SectionHead eyebrow="The inventory" title="Start with what you need." />
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {tiles.slice(0, 4).map((t, i) => (
              <ScrollReveal key={t.href} delay={i * 90}>
                <Link href={t.href} className="group relative block aspect-[3/4] overflow-hidden bg-surface-2 sm:aspect-[4/5]">
                  {t.coverUrl && (
                    <VehicleImage
                      src={t.coverUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.05]"
                    />
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B0A09] via-[#0B0A09]/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                    <p className="figures text-xs text-white/70">{t.count} in stock</p>
                    <p className="mt-1 font-display text-[1.7rem] leading-tight text-white md:text-[2rem]">{t.label}</p>
                    <span className="eyebrow mt-3 inline-block !text-gold-300 transition-transform duration-[var(--duration-base)] group-hover:translate-x-1">
                      Browse →
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* The stock itself. */}
      {featured.length > 0 && (
        <section className="border-t border-border-subtle">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow="In the showroom now" title="Selected vehicles." />
              <ButtonLink href="/vehicles" variant="quiet">
                See all {stats.inStock} vehicles
              </ButtonLink>
            </ScrollReveal>
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featured.map((v, i) => (
                <ScrollReveal key={v.id} delay={(i % 3) * 90}>
                  <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The Drive Plan, explained with a real car. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <ScrollReveal>
            <SectionHead eyebrow="The 40% Drive Plan" title="Drive it home today. Pay the rest on agreed terms.">
              <p>Choose your vehicle, pay 40% of the price, and it leaves the showroom with you. The balance is settled on terms agreed with Sabicars before you drive away.</p>
            </SectionHead>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                ["Choose", "Any vehicle in stock, seen in person or online."],
                ["Pay 40%", "The deposit secures the car and it is yours to drive."],
                ["Settle", "The balance, on the terms you agreed."],
              ].map(([step, text], i) => (
                <li key={step} className="border-t border-gold-700 pt-4">
                  <p className="figures text-xs text-text-muted">0{i + 1}</p>
                  <p className="mt-1 font-display text-2xl">{step}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <ButtonLink href="/drive-plan">How the Drive Plan works</ButtonLink>
            </div>
          </ScrollReveal>

          {example && (
            <ScrollReveal delay={120}>
              <Link href={`/vehicles/${example.slug}`} className="group block border border-border-default bg-surface-0 transition-colors hover:border-border-strong">
                {example.cover && (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <VehicleImage src={example.cover.url} alt={vehicleTitle(example)} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
                  </div>
                )}
                <div className="p-6 md:p-8">
                  <p className="eyebrow !text-text-muted">For example</p>
                  <p className="mt-2 font-display text-[1.9rem] leading-tight">{vehicleTitle(example)}</p>
                  <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-border-subtle pt-5">
                    <div>
                      <dt className="text-xs text-text-muted">Price</dt>
                      <dd className="figures mt-1 font-semibold">{priceLabel(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Pay today</dt>
                      <dd className="figures mt-1 font-semibold text-accent-text">{drivePlanDeposit(example)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Balance</dt>
                      <dd className="figures mt-1 font-semibold">{drivePlanBalance(example)}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* Fleet and government. */}
      <section className="relative isolate overflow-hidden border-t border-border-subtle bg-[#0B0A09]">
        {tiles.find((t) => t.label === "Buses & Hiace")?.coverUrl && (
          <VehicleImage
            src={tiles.find((t) => t.label === "Buses & Hiace")!.coverUrl!}
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover opacity-45"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim)" }} />
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
          <ScrollReveal className="max-w-2xl">
            <p className="eyebrow !text-gold-300">Fleet &amp; Government</p>
            <h2 className="mt-4 text-display-2 text-[var(--hero-text)]">One supplier for the whole fleet.</h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--hero-text-secondary)]">
              Companies and government bodies buy from Sabicars in volume — Toyota Hiace buses, SUVs and staff cars, sourced,
              documented and delivered as a single order, with one team accountable from quotation to handover.
            </p>
            <Link
              href="/fleet"
              className="mt-10 inline-flex min-h-14 items-center bg-gold-500 px-8 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#0B0A09] transition-colors [font-stretch:115%] hover:bg-gold-400"
            >
              Request a fleet quotation
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* The founder. */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <ScrollReveal>
            <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
              <Image src="/founder.jpg" alt="Ccristian Dee, founder of Sabicars Limited" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="eyebrow">The founder</p>
            <blockquote className="mt-6">
              <p className="font-display text-[1.9rem] leading-[1.25] text-text-primary md:text-[2.4rem]">
                “Every vehicle that leaves our plaza carries my name on it — accident-free, verified, and exactly as described. That’s not
                a slogan, it’s how I built this.”
              </p>
              <footer className="mt-8">
                <p className="font-medium text-text-primary">Ccristian Dee</p>
                <p className="text-sm text-text-muted">Prince Emmanuel Abisoye · Founder &amp; CEO, {site.legalName}</p>
              </footer>
            </blockquote>
            <div className="mt-10">
              <ButtonLink href="/about" variant="quiet">
                The Sabicars story
              </ButtonLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Come and see it. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:items-end">
          <ScrollReveal>
            <SectionHead eyebrow="Visit" title="See it before you commit.">
              <p>Walk in and inspect any vehicle in person before you pay.</p>
            </SectionHead>
          </ScrollReveal>
          <ScrollReveal delay={120} className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="eyebrow !text-text-muted">Showroom</p>
              <Address className="mt-3 text-text-secondary" />
              <a
                href={site.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="eyebrow mt-4 inline-block"
              >
                Get directions →
              </a>
            </div>
            <div>
              <p className="eyebrow !text-text-muted">Call</p>
              <ul className="mt-3 space-y-1">
                {site.phones.map((p) => (
                  <li key={p.e164}>
                    <a href={`tel:${p.e164}`} className="figures text-lg text-text-primary hover:text-accent-text">
                      {p.display}
                    </a>
                  </li>
                ))}
              </ul>
              <a href={`mailto:${site.email}`} className="mt-3 block text-sm text-text-secondary hover:text-text-primary">
                {site.email}
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
