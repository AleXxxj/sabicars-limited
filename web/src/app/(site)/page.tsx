import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Address } from "@/components/site/Address";
import { VehicleCard } from "@/components/VehicleCard";
import { VehicleImage } from "@/components/VehicleImage";
import { DrivePlanFinder } from "@/components/home/DrivePlanFinder";
import { HeroShowcase, type HeroSlide } from "@/components/home/HeroShowcase";
import { EarningsExamples, PartnerRules } from "@/components/referral/Referral";
import { ArrowRight, CarFront, Layers, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import { categoryTiles, drivePlanCatalogue, featuredVehicles, heroVehicles, heroVideoUrl, hummerBuses, inventoryStats } from "@/lib/repositories/vehicles";
import { mostRequested } from "@/lib/repositories/sourcing";
import { publishedReviews, reviewSummary } from "@/lib/repositories/reviews";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { PostCard } from "@/components/blog/PostCard";
import { latestPosts } from "@/lib/repositories/blog";
import { formatNaira, money, percentOf } from "@/lib/money";
import { dealerJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { site, siteUrl } from "@/lib/site";
import { BUDGET_OPTIONS } from "@/lib/sourcing";
import { DRIVE_PLAN_DEPOSIT_BPS, priceLabel, vehicleTitle } from "@/lib/vehicle";

/**
 * Rebuilt every five minutes, and immediately whenever staff change a vehicle
 * (the admin's actions revalidate "/"), so the homepage never shows stock that
 * has gone.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Sabicars — Toyota Hiace Hummer Buses, Luxury Cars & SUVs in Lagos" },
  alternates: { canonical: "/" },
};

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="kicker">{eyebrow}</p>
      <h2 className="mt-4 text-display-2">{title}</h2>
      {children && <div className="mt-5 text-lg leading-relaxed text-text-secondary">{children}</div>}
    </div>
  );
}

/**
 * The homepage.
 *
 * Its one job: leave every visitor with something on record — an enquiry on a
 * car, a request for a car Sabicars does not have yet, or a partner code.
 * Most arrive on a phone from Christ D's videos, often with more interest
 * than cash, so the page answers their questions in the order they ask them:
 * is this real, what can I afford, what if it isn't here, and can I earn
 * from this. Sabicars' strength is its audience, not its lot; the page is
 * built to capture the audience, not just display the lot.
 */
export default async function Home() {
  const [hero, featured, stats, tiles, videoUrl, catalogue, demand, buses, reviews, reviewStats, posts] = await Promise.all([
    heroVehicles(8),
    featuredVehicles(6),
    inventoryStats(),
    categoryTiles(),
    heroVideoUrl(),
    drivePlanCatalogue(),
    mostRequested(),
    hummerBuses(),
    publishedReviews(),
    reviewSummary(),
    latestPosts(3),
  ]);
  // The signature: Hummer buses, newest first, those with a photograph.
  const hummers = buses.filter((b) => /hum+er/i.test(b.model) && b.cover);
  const hummerFrom = hummers.map((b) => b.priceMinor).filter((p): p is number => Boolean(p)).sort((a, b) => a - b)[0] ?? null;

  // Staff choose hero vehicles; if none are chosen, lead with featured stock
  // rather than an empty backdrop.
  const heroSource = (hero.length ? hero : featured).filter((v) => v.cover);
  const slides: HeroSlide[] = heroSource.map((v) => ({ url: v.cover!.url, title: vehicleTitle(v), price: priceLabel(v), href: `/vehicles/${v.slug}` }));

  // The smallest deposit that drives a car home today, from the cheapest available vehicle.
  const lowestDeposit = catalogue[0] ? percentOf(money(catalogue[0].priceMinor, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor : null;
  const busCover = tiles.find((t) => t.key === "buses")?.coverUrl;

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

      {/* Is this real? Facts, live from the inventory and the register. */}
      <section aria-label="At a glance" className="relative z-10 -mt-12 md:-mt-16">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-5 md:grid-cols-4 md:gap-4 md:px-10">
          {[
            { value: String(stats.inStock), label: "Vehicles in stock today", icon: CarFront },
            { value: lowestDeposit ? formatNaira(lowestDeposit, { compact: true }) : "—", label: "Lowest deposit on the 40% Drive Plan", icon: Wallet },
            { value: String(stats.makes), label: "Makes, from Toyota to Mercedes-Benz", icon: Layers },
            { value: site.rcNumber, label: "CAC registered — verify it", href: site.cacSearchUrl, icon: ShieldCheck },
          ].map(({ value, label, href, icon: Icon }) => (
            <div key={label} className="glass rounded-2xl p-4 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.9)] md:p-6">
              <dt className="sr-only">{label}</dt>
              <dd>
                <Icon aria-hidden size={20} strokeWidth={1.75} className="text-gold-300" />
                <span className="figures mt-3 block font-display text-[2.1rem] leading-none text-text-primary md:text-[2.75rem]">{value}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[0.82rem] leading-snug text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
                    {label} ↗
                  </a>
                ) : (
                  <span className="mt-2 block text-[0.82rem] leading-snug text-text-secondary">{label}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The signature vehicle: what Sabicars is known for, first. */}
      {hummers.length > 0 && (
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(800px_420px_at_85%_40%,rgb(201_168_76/0.1),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
            <ScrollReveal>
              <SectionHead eyebrow="The signature" title="The home of the Hummer bus.">
                <p>
                  The Toyota Hiace high-roof — for staff, schools, churches, hotels and routes — is what Sabicars is known for. In stock,
                  inspected, supplied one at a time or as a fleet, and on the 40% Drive Plan.
                </p>
              </SectionHead>
              <dl className="mt-8 grid grid-cols-3 gap-3">
                {[
                  [String(hummers.length), "in stock now"],
                  [hummerFrom ? formatNaira(hummerFrom, { compact: true }) : "—", "starting price"],
                  [hummerFrom ? formatNaira(percentOf(money(hummerFrom, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor, { compact: true }) : "—", "40% deposit from"],
                ].map(([value, label]) => (
                  <div key={label} className="surface-card !rounded-2xl p-4">
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      <span className="figures block font-display text-[1.8rem] leading-none md:text-[2.2rem]">{value}</span>
                      <span className="mt-1.5 block text-[0.78rem] text-text-muted">{label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/hummer-bus" size="lg">
                  See every Hummer bus
                </ButtonLink>
                <ButtonLink href="/fleet#quote" size="lg" variant="secondary">
                  Quote me a fleet
                </ButtonLink>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <Link href={`/vehicles/${hummers[0].slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-3xl border border-white/[0.08] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)]">
                <VehicleImage
                  src={hummers[0].cover!.url}
                  alt={vehicleTitle(hummers[0])}
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0A0908]/80 via-transparent to-transparent" />
                <span className="glass absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-white">
                  <span className="truncate">{vehicleTitle(hummers[0])}</span>
                  <span className="figures shrink-0 font-semibold text-gold-200">{priceLabel(hummers[0])}</span>
                </span>
              </Link>
              {hummers.length > 1 && (
                <ul className="mt-3 grid grid-cols-3 gap-3">
                  {hummers.slice(1, 4).map((b) => (
                    <li key={b.id}>
                      <Link href={`/vehicles/${b.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08]">
                        <VehicleImage src={b.cover!.url} alt={vehicleTitle(b)} fill sizes="(min-width: 1024px) 18vw, 30vw" className="object-cover transition-transform group-hover:scale-[1.05]" />
                        <span className="figures absolute bottom-1.5 left-1.5 rounded-full bg-[#0A0908]/75 px-2 py-0.5 text-[0.7rem] text-white">{b.year}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* What can I afford? Answered from live stock, as they type. */}
      {catalogue.length > 0 && (
        <section id="drive-plan" className="scroll-mt-20 border-t border-white/[0.06] md:scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <DrivePlanFinder vehicles={catalogue}>
              <ScrollReveal>
                <SectionHead eyebrow="The 40% Drive Plan" title="What can your 40% drive home?">
                  <p>
                    Pay 40% of the price. Autochek, Sabicars’ financing partner, finances the remaining 60%, subject to its approval.
                    Tell us what you can put down — the answer comes from what is in stock right now.
                  </p>
                </SectionHead>
                <ButtonLink href="/drive-plan" variant="quiet" className="mt-4">
                  How the Drive Plan works
                </ButtonLink>
              </ScrollReveal>
            </DrivePlanFinder>
          </div>
        </section>
      )}

      {/* Ways in. */}
      {tiles.length > 0 && (
        <section className="border-t border-border-subtle bg-surface-1">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <ScrollReveal>
              <SectionHead eyebrow="The inventory" title="Start with what you need." />
            </ScrollReveal>
            <div className="mt-12 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              {tiles.slice(0, 4).map((t, i) => (
                <ScrollReveal key={t.href} delay={i * 90}>
                  <Link href={t.href} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-2 sm:aspect-[4/5]">
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
                      <p className="figures glass inline-block rounded-full px-2.5 py-0.5 text-xs text-white/85">{t.count} in stock</p>
                      <p className="mt-1 font-display text-[1.7rem] leading-tight text-white md:text-[2rem]">{t.label}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300">
                        Browse <ArrowRight aria-hidden size={16} className="transition-transform duration-[var(--duration-base)] group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
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
            {/* On a phone, a row to swipe through — the pattern every shopping app uses — instead of 4,000px of stacked cards. */}
            <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] md:mx-0 md:mt-12 md:grid md:snap-none md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
              {featured.map((v, i) => (
                <ScrollReveal key={v.id} delay={(i % 3) * 90} className="w-[84%] shrink-0 snap-start sm:w-[60%] md:w-auto">
                  <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* What if it isn't here? The request is kept, not lost. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-2 lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionHead eyebrow="The Sourcing Desk" title="Not in the showroom? Put it on the desk.">
              <p>
                Tell us the vehicle and your budget. Your request is recorded with a reference, it joins the list Sabicars sources from,
                and the moment a match arrives, you are told.
              </p>
            </SectionHead>
            {demand.length > 0 && (
              <div className="mt-10">
                <p className="text-sm font-medium text-text-muted">Most requested right now</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {demand.map((d) => (
                    <li key={d.want} className="rounded-full border border-border-default bg-surface-1 px-3.5 py-1.5 text-sm text-text-secondary">
                      {d.want} <span className="figures text-text-muted">· {d.requests}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <Form action="/find" className="surface-card grid gap-6 p-6 md:p-10">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-text-secondary">What are you looking for?</span>
                <input name="want" required maxLength={120} placeholder="e.g. Toyota Highlander, 2018 or newer" className={fieldClass} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-text-secondary">Budget for the vehicle</span>
                <select name="budget" defaultValue="" className={fieldClass}>
                  <option value="">Not sure yet</option>
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button type="submit" size="lg" arrow>
                  Continue
                </Button>
                <span className="text-sm text-text-muted">Next: where to reach you.</span>
              </div>
            </Form>
          </ScrollReveal>
        </div>
      </section>

      {/* Fleet and government. */}
      <section className="relative isolate overflow-hidden border-t border-border-subtle bg-[#0B0A09]">
        {busCover && <VehicleImage src={busCover} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-45" />}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--hero-scrim)" }} />
        <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
          <ScrollReveal className="max-w-2xl">
            <p className="kicker">Fleet &amp; Government</p>
            <h2 className="mt-4 text-display-2 text-[var(--hero-text)]">One supplier for the whole fleet.</h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--hero-text-secondary)]">
              Companies and government bodies buy from Sabicars in volume — Toyota Hiace buses, SUVs and staff cars, sourced,
              documented and delivered as a single order, with one team accountable from quotation to handover.
            </p>
            <ButtonLink href="/fleet" size="lg" className="mt-10">
              Request a fleet quotation
            </ButtonLink>
          </ScrollReveal>
        </div>
      </section>

      {/* The man the audience came for. */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <ScrollReveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/[0.08] bg-surface-2 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)]">
              <Image src="/founder.jpg" alt="Ccristian Dee, founder of Sabicars Limited" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="kicker">The founder</p>
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

      {/* Is it true? In customers' own words, each read by a person first. */}
      <ReviewsSection reviews={reviews} summary={reviewStats} />

      {/* Can I earn from this? A commission on sales, on plain terms. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <ScrollReveal>
              <SectionHead eyebrow="Refer & Earn" title="Know a buyer? Earn 1.5% when they buy.">
                <p>
                  Register free and get your own link. When a buyer you sent completes a purchase, 1.5% of the price is yours — and they
                  are recorded against your code from their first enquiry, so nobody can claim them.
                </p>
              </SectionHead>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                <ButtonLink href="/partners#register" size="lg">
                  Become a partner
                </ButtonLink>
                <ButtonLink href="/partners" variant="quiet">
                  How it works
                </ButtonLink>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <EarningsExamples vehicles={catalogue} />
            </ScrollReveal>
          </div>
          <div className="mt-16 md:mt-20">
            <PartnerRules />
          </div>
        </div>
      </section>

      {/* Know more than the seller: the latest from Insights. */}
      {posts.length > 0 && (
        <section className="border-t border-border-subtle">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
            <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow="Insights" title="Know more than the seller." />
              <ButtonLink href="/blog" variant="quiet">
                Every article
              </ButtonLink>
            </ScrollReveal>
            <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => (
                <ScrollReveal key={p.slug} delay={i * 90}>
                  <PostCard post={p} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Come and see it. */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:items-end">
          <ScrollReveal>
            <SectionHead eyebrow="Visit" title="See it before you commit.">
              <p>Walk in and inspect any vehicle in person before you pay.</p>
            </SectionHead>
          </ScrollReveal>
          <ScrollReveal delay={120} className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-text-muted">Showroom</p>
              <Address className="mt-3 text-text-secondary" />
              <ButtonAnchor href={site.mapsUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className="mt-5">
                <MapPin aria-hidden size={17} /> Get directions
              </ButtonAnchor>
            </div>
            <div>
              <p className="text-sm font-medium text-text-muted">Call</p>
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
