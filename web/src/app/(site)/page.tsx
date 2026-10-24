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
import { HomeSearch } from "@/components/home/HomeSearch";
import { PostCard } from "@/components/blog/PostCard";
import { MapPin } from "lucide-react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import {
  categoryTiles,
  drivePlanCatalogue,
  everyListedCarVerified,
  featuredVehicles,
  heroVehicles,
  heroVideoUrl,
  hummerBuses,
  inventoryStats,
  searchTerms,
} from "@/lib/repositories/vehicles";
import { mostRequested } from "@/lib/repositories/sourcing";
import { publishedReviews, reviewSummary } from "@/lib/repositories/reviews";
import { ReviewRating, ReviewsSection } from "@/components/reviews/ReviewsSection";
import { WriteReview } from "@/components/reviews/WriteReview";
import { latestPosts } from "@/lib/repositories/blog";
import { formatNaira } from "@/lib/money";
import { dealerJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { pageAddress, site, siteUrl } from "@/lib/site";
import { BUDGET_OPTIONS } from "@/lib/sourcing";
import { DRIVE_PLAN, depositMinorFor } from "@/lib/drive-plan";
import { ATTRIBUTION_DAYS } from "@/lib/referral";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

/**
 * Rebuilt every five minutes, and immediately whenever staff change a vehicle
 * (the admin's actions revalidate "/"), so the homepage never shows stock that
 * has gone.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Sabicars — Toyota Hiace Hummer Buses, Luxury Cars & SUVs in Lagos" },
  ...pageAddress("/"),
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
  const [hero, featuredStock, stats, tiles, videoUrl, catalogue, demand, buses, reviews, reviewStats, posts, allVerified, terms] = await Promise.all([
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
    everyListedCarVerified(),
    searchTerms(),
  ]);
  // Hummer buses, newest first, those with a photograph.
  const hummers = buses.filter((b) => /hum+er/i.test(b.model) && b.cover);
  const hummerFrom = hummers.map((b) => b.priceMinor).filter((p): p is number => Boolean(p)).sort((a, b) => a - b)[0] ?? null;

  // The featured row: staff's choice (Inventory → Featured), with the signature bus among the first three, the ones a desktop
  // shows, whenever one is listed. Staff's own Hummer pick if they ticked one; otherwise a Hummer 1, then any Hummer.
  const featured = [...featuredStock];
  const firstHummer = featured.findIndex((v) => /hum+er/i.test(v.model));
  if (firstHummer > 2) featured.splice(1, 0, ...featured.splice(firstHummer, 1));
  else if (firstHummer === -1 && hummers.length) {
    featured.splice(1, 0, hummers.find((b) => /hum+er\s*1\b/i.test(b.model)) ?? hummers[0]);
    featured.splice(6); // the row holds six
  }

  // Find your car: every make and model family in stock; the shortcuts are the Hummer bus, the model families with the most cars in stock, and two budgets.
  const stockTerms = terms.filter((t) => t.inStock > 0);
  const shortcuts = [
    ...(hummers.length ? [{ label: "Hummer buses", href: "/hummer-bus" }] : []),
    ...stockTerms
      .filter((t) => t.family && !/hum+er/i.test(t.label))
      .slice(0, 3)
      .map((t) => ({ label: t.label, href: `/buy/${t.slug}` })),
    { label: "Under ₦20M", href: "/vehicles?maxPrice=20000000&sort=price_desc" },
  ];

  // Staff choose hero vehicles; if none are chosen, lead with featured stock
  // rather than an empty backdrop.
  const heroSource = (hero.length ? hero : featured).filter((v) => v.cover);
  const slides: HeroSlide[] = heroSource.map((v) => ({ url: v.cover!.url, title: vehicleTitle(v), price: priceLabel(v), href: `/vehicles/${v.slug}` }));

  // The smallest deposit that drives a car home today: each car at its own tier, so a 2009 car at 50% is not mistaken for the cheapest.
  const lowestDeposit = catalogue.length ? Math.min(...catalogue.map((v) => v.depositMinor)) : null;
  if (lowestDeposit !== null) {
    // Rounded up to the next ₦100,000, so the cheapest car is always in the list it opens.
    const reach = Math.ceil(lowestDeposit / 100 / 100_000) * 100_000;
    shortcuts.push({ label: `Drive Plan from ${formatNaira(lowestDeposit, { compact: true })} down`, href: `/vehicles?maxDeposit=${reach}` });
  }
  const hummerDepositFrom = hummers.map((b) => depositMinorFor(b.priceMinor, b.year)).filter((d): d is number => d !== null).sort((a, b) => a - b)[0] ?? null;

  // The way in for buying several vehicles: beside the Hummer bus, or on its own when no Hummer is listed.
  const bulkBuying = (Heading: "h2" | "h3") => (
    <>
      <Heading className="text-[1.35rem] leading-snug text-text-primary">Buying several vehicles at once?</Heading>
      <p className="mt-2 leading-relaxed text-text-secondary">
        Companies and government offices buy buses, SUVs and staff cars from us as one order. You get one written quote for the whole
        order, and one team.
      </p>
      <ButtonLink href="/fleet#quote" variant="quiet" className="mt-2">
        Get a price for several vehicles
      </ButtonLink>
    </>
  );

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

      <HeroShowcase slides={slides} videoUrl={videoUrl} allVerified={allVerified} />

      {/* Do they have what I want? One field, answered from the stock as they type — or by Ask Sabicars. */}
      <section aria-label="Find your car" className="relative z-10 -mt-12 md:-mt-16">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <HomeSearch terms={stockTerms.map((t) => ({ slug: t.slug, label: t.label, fromMinor: t.fromMinor }))} shortcuts={shortcuts} hummers={hummers.length > 0} />
        </div>
      </section>

      {/* The signature vehicle: what Sabicars is known for, first — and the way in for buying several. */}
      {hummers.length === 0 && (
        // No Hummer listed with a photo (sold out, or not yet photographed): the way in for buying several still shows.
        <section className="border-t border-border-subtle">
          <div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-14">
            <p className="kicker">Buy in bulk</p>
            <div className="mt-3">{bulkBuying("h2")}</div>
          </div>
        </section>
      )}
      {hummers.length > 0 && (
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(800px_420px_at_85%_40%,rgb(120_176_48/0.1),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
            <ScrollReveal>
              <SectionHead eyebrow="Hummer buses" title="The home of the Hummer bus.">
                <p>
                  Sabicars is known for the Toyota Hiace high-roof bus, for staff, schools, churches, hotels and routes. Come and inspect one,
                  buy one or several, or buy on the 40% Drive Plan.
                </p>
              </SectionHead>
              <p className="figures mt-6 text-text-primary">
                {[
                  hummerFrom && `From ${formatNaira(hummerFrom, { compact: true })}`,
                  hummerDepositFrom && `Drive Plan deposit from ${formatNaira(hummerDepositFrom, { compact: true })}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ButtonLink href="/hummer-bus" size="lg" variant="signature" className="mt-8">
                See every Hummer bus
              </ButtonLink>

              {/* Companies and government buy buses in numbers: the fleet route lives here, beside the bus. */}
              <div className="mt-10 border-t border-white/[0.08] pt-6">{bulkBuying("h3")}</div>
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
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#090E0A]/80 via-transparent to-transparent" />
                <span className="glass absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-white">
                  <span className="truncate">{vehicleTitle(hummers[0])}</span>
                  <span className="figures shrink-0 font-semibold text-green-200">{priceLabel(hummers[0])}</span>
                </span>
              </Link>
              {hummers.length > 1 && (
                <ul className="mt-3 grid grid-cols-3 gap-3">
                  {hummers.slice(1, 4).map((b) => (
                    <li key={b.id}>
                      <Link href={`/vehicles/${b.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08]">
                        <VehicleImage src={b.cover!.url} alt={vehicleTitle(b)} fill sizes="(min-width: 1024px) 18vw, 30vw" className="object-cover transition-transform group-hover:scale-[1.05]" />
                        <span className="figures absolute bottom-1.5 left-1.5 rounded-full bg-[#090E0A]/75 px-2 py-0.5 text-[0.7rem] text-white">{b.year}</span>
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
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
            <DrivePlanFinder vehicles={catalogue}>
              <ScrollReveal>
                <SectionHead eyebrow="The 40% Drive Plan" title="What can your deposit drive home?">
                  <p>
                    Pay 40% of the price on a car from {DRIVE_PLAN.standardYear} or newer, or 50% on a {DRIVE_PLAN.minYear} or{" "}
                    {DRIVE_PLAN.standardYear - 1} car. A loan through Autochek, our finance partner, covers the rest if its lender approves you.
                    You repay it monthly. Type how much you can pay now to see which cars in stock you can get with it.
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

      {/* What is here? The stock by the shape buyers ask for, then the cars themselves. */}
      {(tiles.length > 0 || featured.length > 0) && (
        <section className="border-t border-border-subtle">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
            <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow="Cars for sale" title="Start with what you need." />
              <ButtonLink href="/vehicles" variant="quiet">
                See all {stats.inStock} cars for sale
              </ButtonLink>
            </ScrollReveal>
            {tiles.length > 0 && (
              <nav aria-label="Vehicle type" className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
                {tiles.slice(0, 4).map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border-default px-4 text-sm font-semibold text-text-secondary transition-colors duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
                  >
                    {t.label} <span className="figures opacity-70">{t.count}</span>
                  </Link>
                ))}
              </nav>
            )}
            {/* On a phone, a row to swipe through — the pattern every shopping app uses — instead of 4,000px of stacked cards. On a desktop, one row. */}
            {featured.length > 0 && (
              <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] md:mx-0 md:mt-10 md:grid md:snap-none md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden md:[&>*:nth-child(n+5)]:hidden xl:[&>*:nth-child(n+4)]:hidden">
                {featured.map((v, i) => (
                  <ScrollReveal key={v.id} delay={(i % 3) * 90} className="w-[84%] shrink-0 snap-start sm:w-[60%] md:w-auto">
                    <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* What if it isn't here? The request is kept, not lost. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:px-10 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionHead eyebrow="Request a car" title="Not in our showroom? Request it.">
              <p>
                Tell us the car and your budget. You get a reference number, and your request goes on the list of cars we look for. When a
                matching car arrives, we tell you.
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

      {/* Who you are buying from: the man the audience came for, then his customers in their own words, each read by a person first.
          #reviews lands here, on the founder block; the rating and "Write a review" follow the quote, and the reviews come just below. */}
      <section id="reviews" className="scroll-mt-24 border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-16 md:px-10 md:pt-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <ScrollReveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/[0.08] bg-surface-2 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)] lg:aspect-square">
              <Image src="/founder.jpg" alt="Ccristian Dee, founder of Sabicars Limited" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="kicker">Who you are buying from</p>
            <blockquote className="mt-6">
              <p className="font-display text-[1.9rem] leading-[1.25] text-text-primary md:text-[2.4rem]">
                “Every vehicle that leaves our showroom carries my name on it … That’s not a slogan, it’s how I built this.”
              </p>
              <footer className="mt-8">
                <p className="font-medium text-text-primary">Ccristian Dee</p>
                <p className="text-sm text-text-muted">Prince Emmanuel Abisoye · Founder &amp; CEO, {site.legalName}</p>
              </footer>
            </blockquote>
            <ReviewRating summary={reviewStats} className="mt-8" />
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
              <WriteReview />
              <ButtonLink href="/about" variant="quiet">
                The Sabicars story
              </ButtonLink>
            </div>
          </ScrollReveal>
        </div>
      </section>
      <ReviewsSection reviews={reviews} summary={reviewStats} head={false} />

      {/* Can I earn from this? A commission on sales, on plain terms. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <ScrollReveal>
              <SectionHead eyebrow="Refer & Earn" title="Know a buyer? Earn 1.5% when they buy.">
                <p>
                  Register free and get your own link. When someone you sent buys from Sabicars, 1.5% of the price is yours. They are linked to
                  your code for {ATTRIBUTION_DAYS} days from their first enquiry, so nobody else can claim them.
                </p>
              </SectionHead>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                <ButtonLink href="/partners#register" size="lg">
                  Get your free link
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
          {/* The rules in full, the same cards /partners shows: what keeps this a commission on sales, never a scheme. */}
          <div className="mt-14 md:mt-16">
            <PartnerRules />
          </div>
        </div>
      </section>

      {/* Read before you buy: the latest buying guides, each with its picture — the way most readers find them. */}
      {posts.length > 0 && (
        <section className="border-t border-border-subtle">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
            <ScrollReveal className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead eyebrow="Buying guides" title="Read before you buy." />
              <ButtonLink href="/blog" variant="quiet">
                All buying guides
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

      {/* Come and see it. The phones and email are in the footer, just below. */}
      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:items-end">
          <ScrollReveal>
            <SectionHead eyebrow="Visit" title="See it before you pay.">
              <p>Walk in and inspect the cars at our showroom before you pay.</p>
            </SectionHead>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="text-sm font-medium text-text-muted">Showroom</p>
            <Address className="mt-3 text-text-secondary" />
            <ButtonAnchor href={site.mapsUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className="mt-5">
              <MapPin aria-hidden size={17} /> Get directions
            </ButtonAnchor>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
