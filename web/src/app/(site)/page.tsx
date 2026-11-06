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
import { TodayAtThePark } from "@/components/home/TodayAtThePark";
import { TodayVideo } from "@/components/home/TodayVideo";
import { EarningsHook, PartnerPromises } from "@/components/referral/Referral";
import { HomeSearch } from "@/components/home/HomeSearch";
import { PostCard } from "@/components/blog/PostCard";
import { MapPin } from "lucide-react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import {
  arrivedThisWeek,
  categoryTiles,
  drivePlanCatalogue,
  everyListedCarVerified,
  featuredVehicles,
  heroVehicles,
  heroVideoUrl,
  hummerBuses,
  inventoryStats,
  priceDropsThisWeek,
  searchTerms,
} from "@/lib/repositories/vehicles";
import { mostRequested } from "@/lib/repositories/sourcing";
import { todayVideo } from "@/lib/repositories/today";
import { publishedReviews, reviewSummary } from "@/lib/repositories/reviews";
import { ReviewRating, ReviewsSection } from "@/components/reviews/ReviewsSection";
import { WriteReview } from "@/components/reviews/WriteReview";
import { latestPosts } from "@/lib/repositories/blog";
import { formatNaira } from "@/lib/money";
import { dealerJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { pageAddress, site, siteUrl } from "@/lib/site";
import { DRIVE_PLAN, depositMinorFor } from "@/lib/drive-plan";
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
  const [hero, featuredStock, stats, tiles, videoUrl, catalogue, demand, buses, reviews, reviewStats, posts, allVerified, terms, arrivals, drops, video] =
    await Promise.all([
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
      arrivedThisWeek(),
      priceDropsThisWeek(),
      todayVideo(),
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

      {/* The reason to open Sabicars today: what is new this week and whose price dropped. */}
      <TodayAtThePark arrivals={arrivals} drops={drops} />

      {/* The signature vehicle: what Sabicars is known for, first. One thing at a time: the way in for buying several
          buses lives on the Hummer page and under Buy in bulk, not here, so the bus is seen before anything else is read. */}
      {hummers.length > 0 && (
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(800px_420px_at_85%_40%,rgb(120_176_48/0.1),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
            <ScrollReveal>
              <SectionHead eyebrow="Hummer buses" title="The home of the Hummer bus.">
                <p>
                  We are known for the Toyota Hiace Hummer bus: for staff, schools, churches, hotels and transport. Come and see one. Buy one or
                  many, or pay 40% now on the Drive Plan.
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
                <SectionHead eyebrow="The 40% Drive Plan" title="How much do you have?">
                  <p>
                    Pay 40% now on a car from {DRIVE_PLAN.standardYear} up. Autochek lends you the rest if they approve you, and you pay
                    monthly. Type what you have and see the cars you can drive home.
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
              <SectionHead eyebrow="Cars for sale" title="What are you looking for?" />
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

      {/* What if it isn't here? One box: the car. The budget and how to reach them are asked on /find, the next step. */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionHead eyebrow="Request a car" title="Can't find your car? Tell us.">
              <p>Tell us the car. When it comes in, we tell you.</p>
            </SectionHead>
            {demand.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-medium text-text-muted">What people are asking for now</p>
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
            <Form action="/find" className="surface-card grid gap-4 p-5 md:p-8">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-text-secondary">What car do you want?</span>
                <input name="want" required maxLength={120} placeholder="e.g. Toyota Highlander, 2018 or newer" className={fieldClass} />
              </label>
              <Button type="submit" size="lg" arrow className="w-full sm:w-auto">
                Continue
              </Button>
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
              <Image src="/founder.jpg" alt={`Ccristian Dee, founder of ${site.legalName}`} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="kicker">The man behind Sabicars</p>
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
        {/* The day's video from the park, with his line for the day: his face, his words, then today's words. */}
        {video && (
          <div className="mx-auto max-w-7xl px-5 pt-14 md:px-10 md:pt-16">
            <ScrollReveal>
              <TodayVideo video={video} />
            </ScrollReveal>
          </div>
        )}
      </section>
      <ReviewsSection reviews={reviews} summary={reviewStats} head={false} />

      {/* Can I earn from this? One real car and what one buyer earns, the three promises, and the way in. The rules in full and
          more examples are on /partners: one thing at a time (the owner's review, 2026-11-06). */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-20">
          <ScrollReveal>
            <SectionHead eyebrow="Refer & Earn" title="Know a buyer? Earn 1.5% when they buy." />
            <PartnerPromises className="mt-6" />
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
              <ButtonLink href="/partners#register" size="lg">
                Get your free link
              </ButtonLink>
              <ButtonLink href="/partners" variant="quiet">
                How it works
              </ButtonLink>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <EarningsHook vehicles={catalogue} />
          </ScrollReveal>
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
            {/* On a phone, a row to swipe, like the cars: one guide at a time instead of three stacked. On a desktop, a grid. */}
            <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:mx-0 md:mt-12 md:grid md:snap-none md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
              {posts.map((p, i) => (
                <ScrollReveal key={p.slug} delay={i * 90} className="w-[84%] shrink-0 snap-start sm:w-[60%] md:w-auto">
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
            <SectionHead eyebrow="Visit" title="Come to the park.">
              <p>Come and see the cars yourself before you pay. We are at the park every day.</p>
            </SectionHead>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <p className="text-sm font-medium text-text-muted">Our park</p>
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
