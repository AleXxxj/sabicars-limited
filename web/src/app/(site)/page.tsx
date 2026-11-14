import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Address } from "@/components/site/Address";
import { VehicleCard } from "@/components/VehicleCard";
import { VehicleImage } from "@/components/VehicleImage";
import { DrivePlanFinder } from "@/components/home/DrivePlanFinder";
import { HeroSlides } from "@/components/home/HeroSlides";
import { heroDeck, type HeroSlide } from "@/components/home/heroDeck";
import { AskButton } from "@/components/assistant/AskButton";
import { REFERRAL_COMMISSION_BPS } from "@/lib/referral";
import { TodayAtThePark } from "@/components/home/TodayAtThePark";
import { TodayVideo } from "@/components/home/TodayVideo";
import { EarningsRow, PartnerPromises } from "@/components/referral/Referral";
import { HomeSearch } from "@/components/home/HomeSearch";
import { PostCard } from "@/components/blog/PostCard";
import {
  BadgeCheck,
  Camera,
  CarFront,
  ChevronRight,
  Clock,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { fieldClass } from "@/components/forms/field";
import {
  arrivedThisWeek,
  categoryTiles,
  drivePlanCatalogue,
  everyListedCarVerified,
  featuredVehicles,
  heroPicks,
  heroVehicles,
  heroVideo,
  hummerBuses,
  inventoryStats,
  priceDropsThisWeek,
  searchTerms,
} from "@/lib/repositories/vehicles";
import { mostRequested } from "@/lib/repositories/sourcing";
import { todayVideo } from "@/lib/repositories/today";
import { reviewSummary } from "@/lib/repositories/reviews";
import { Stars } from "@/components/reviews/Stars";
import { latestPosts } from "@/lib/repositories/blog";
import { formatNaira } from "@/lib/money";
import { dealerJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { pageAddress, site, siteUrl } from "@/lib/site";
import { DRIVE_PLAN, depositMinorFor } from "@/lib/drive-plan";
import type { HeroSlideKey } from "@/lib/hero-slides";
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

/**
 * Why people trust us: three promises the site already makes and keeps (the About page's standards and the privacy
 * notice), one plain line each. "See it before you pay" is not among them: the hero's first words already say it.
 */
const TRUST: { icon: LucideIcon; text: string }[] = [
  { icon: Camera, text: "The car you get is the car in the photos." },
  // A no-break space, so a narrow phone never leaves "RC" at the end of one line and the number on the next.
  { icon: BadgeCheck, text: `Registered with CAC: RC ${site.rcNumber}.` },
  { icon: ShieldCheck, text: "We never ask for your BVN or card details in a chat or form." },
];

/**
 * The one fact beside the founder's name on his card. It has to be one Sabicars can stand behind (the About page leaves
 * out sales totals until they are confirmed): 300k is the size of his audience across his pages, not a count of cars
 * sold. A number of cars sold goes here once it is confirmed.
 */
const FOUNDER_FACT = "300k followers";

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
  const [hero, featuredStock, stats, tiles, heroVid, catalogue, demand, buses, reviewStats, posts, allVerified, terms, arrivals, drops, video, picked] =
    await Promise.all([
      heroVehicles(8),
      featuredVehicles(6),
      inventoryStats(),
      categoryTiles(),
      heroVideo(),
      drivePlanCatalogue(),
      mostRequested(),
      hummerBuses(),
      reviewSummary(),
      latestPosts(3),
      everyListedCarVerified(),
      searchTerms(),
      arrivedThisWeek(),
      priceDropsThisWeek(),
      todayVideo(),
      heroPicks(),
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
  const photoOf = (v: (typeof heroSource)[number]): HeroSlide => ({
    head: 0,
    src: v.cover!.url,
    // The photo's shape, so the hero can show the whole car and not a cut of it.
    ratio: v.cover!.width && v.cover!.height ? v.cover!.width / v.cover!.height : null,
    name: vehicleTitle(v),
    // A sold car the owner chose to show is said to be sold, where a price would be.
    note: v.status === "sold" ? "Sold" : priceLabel(v),
    href: `/vehicles/${v.slug}`,
  });
  /** The car the owner chose for a slide in Admin, Audience (lib/hero-slides.ts), if there is one. */
  const chosen = (key: HeroSlideKey): HeroSlide | undefined => (picked[key] ? photoOf(picked[key]) : undefined);
  const cars = heroSource.map(photoOf);

  // The smallest deposit that drives a car home today: each car at its own tier, so a 2009 car at 50% is not mistaken for the cheapest.
  const lowestDeposit = catalogue.length ? Math.min(...catalogue.map((v) => v.depositMinor)) : null;
  if (lowestDeposit !== null) {
    // Rounded up to the next ₦100,000, so the cheapest car is always in the list it opens.
    const reach = Math.ceil(lowestDeposit / 100 / 100_000) * 100_000;
    shortcuts.push({ label: `Drive Plan from ${formatNaira(lowestDeposit, { compact: true })} down`, href: `/vehicles?maxDeposit=${reach}` });
  }
  const hummerDepositFrom = hummers.map((b) => depositMinorFor(b.priceMinor, b.year)).filter((d): d is number => d !== null).sort((a, b) => a - b)[0] ?? null;

  // The hero's opening line: one fact, no paragraph (the owner, 14 November 2026). Not the stock count: the Buy door right under it says that.
  const standingLine = `Cars, SUVs and buses${stats.fromMinor ? ` from ${formatNaira(stats.fromMinor, { compact: true })}` : ""}.`;
  // Not the first hero car when another will do: that one opens the page.
  const onPlan = (v: (typeof heroSource)[number]) => v.priceMinor !== null && v.year >= DRIVE_PLAN.standardYear;
  const planCar = picked.plan ?? heroSource.slice(1).find(onPlan) ?? heroSource.find(onPlan);
  const hummerCar = picked.hummer ?? hummers[0];
  // One hero slide per thing Sabicars does, after the opening one, each over a different car, so the hero never repeats
  // itself. The Hummer slide brings a Hummer's photo and the Drive Plan slide a car the plan's words are true of.
  const services: { kicker: string; title: [string, string]; line: string; more: string; href: string; photo?: HeroSlide | null }[] = [
    // Never "Pay 40%" over a car too old for 40%: the photo is a car the words are true of, or the slide stays away.
    ...(planCar
      ? [
          {
            kicker: "40% Drive Plan",
            title: ["Pay 40% now.", "Drive it home."] as [string, string],
            line: `On a car from ${DRIVE_PLAN.standardYear} up. Autochek lends you the rest if they approve you.`,
            more: "How it works",
            href: "/drive-plan",
            photo: photoOf(planCar),
          },
        ]
      : []),
    ...(hummerCar
      ? [
          {
            kicker: "Hummer buses",
            title: ["The home of", "the Hummer bus."] as [string, string],
            line: `For staff, schools, churches and transport.${hummerFrom ? ` From ${formatNaira(hummerFrom, { compact: true })}.` : ""}`,
            more: "See every Hummer bus",
            href: "/hummer-bus",
            photo: photoOf(hummerCar),
          },
        ]
      : []),
    { kicker: "Free VIN check", title: ["Check any car.", "It is free."], line: "Type the VIN (chassis number) and see what the car really is.", more: "Check a car", href: "/check", photo: chosen("check") },
    { kicker: "Sell or swap", title: ["Sell us your car.", "Or swap it."], line: "Sell it to us, swap it for another, or we sell it for you.", more: "Tell us about your car", href: "/sell", photo: chosen("sell") },
    { kicker: "Request a car", title: ["Can’t find it?", "Tell us."], line: "Tell us the car you want. When it comes in, we tell you.", more: "Request a car", href: "/find", photo: chosen("find") },
    { kicker: "Earn", title: ["Know a buyer?", `Earn ${REFERRAL_COMMISSION_BPS / 100}%.`], line: "Free to join. You are paid when your buyer buys.", more: "Get your free link", href: "/partners", photo: chosen("earn") },
  ];

  // What do you need? Six doors, each with a live line. No line names the total stock: the owner took the count off every
  // page (14 November 2026), so Buy says where the prices start.
  const tilesNeed: { title: string; detail: string; href: string; tint: string; icon: LucideIcon; photos?: string[] }[] = [
    {
      title: "Buy a car",
      detail: stats.fromMinor ? `From ${formatNaira(stats.fromMinor, { compact: true })}` : "Cars for sale",
      href: "/vehicles",
      tint: "buy",
      icon: CarFront,
      photos: featured.filter((v) => v.cover).slice(0, 3).map((v) => v.cover!.url),
    },
    // Never "Pay 40%" on its own: the terms that make it true are in the Drive Plan section further down, not under the tiles.
    { title: "40% Drive Plan", detail: lowestDeposit !== null ? `From ${formatNaira(lowestDeposit, { compact: true })} down` : `On cars from ${DRIVE_PLAN.standardYear} up`, href: "/drive-plan", tint: "plan", icon: Wallet },
    { title: "Check VIN", detail: "Free check", href: "/check", tint: "check", icon: ScanSearch },
    { title: "Sell your car", detail: "Sell or swap", href: "/sell", tint: "sell", icon: Tag },
    { title: "Request a car", detail: "We look for it", href: "/find", tint: "find", icon: Search },
    { title: `Earn ${REFERRAL_COMMISSION_BPS / 100}%`, detail: "When your buyer buys", href: "/partners", tint: "earn", icon: HandCoins },
  ];

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

      {/* The hero, built the way the Adedayo Aremu Autos hero is (the owner, 14 November 2026): the cars one after another with
          words on the photo and the three doors right under it. Every slide has its own words and its own car: the opening
          one, then one for each thing Sabicars does. Nothing is said twice in one turn. */}
      <HeroSlides
        slides={heroDeck(
          cars,
          [{ head: 0, photo: chosen("opening") }, ...services.map((sv, i) => ({ head: i + 1, label: sv.kicker, photo: sv.photo }))],
          // More sets of words than hero cars: the other featured cars lend their photos, so none comes round twice.
          featured.filter((v) => v.cover).map(photoOf),
        )}
        videoUrl={heroVid.url}
        videoSeconds={heroVid.seconds}
        heads={[
          <Fragment key="standing">
            <p className="home-eyebrow">Car dealer in Nigeria</p>
            <h1 className="hh-title">
              {allVerified ? "Every car checked." : "Your next car is here."}
              <span>See it before you pay.</span>
            </h1>
            <p className="hh-line figures">{standingLine}</p>
          </Fragment>,
          ...services.map((sv) => (
            <Fragment key={sv.kicker}>
              <p className="home-eyebrow">{sv.kicker}</p>
              <h2 className="hh-title">
                {sv.title[0]}
                <span>{sv.title[1]}</span>
              </h2>
              <p className="hh-line hh-line--terms">
                {sv.line}{" "}
                <Link href={sv.href} className="hh-more">
                  {sv.more}
                </Link>
              </p>
            </Fragment>
          )),
        ]}
      >
        {/* Three doors, each with its own colour and one fact: Buy is the one in Sabicars' orange. The hidden comma makes a
            screen reader say "Buy, Cars for sale". Buy names no count: the owner took the total stock off every page
            (14 November 2026), and its prices are in the opening line just above, so the door does not repeat them. */}
        <nav aria-label="Start here" className="hh-actions">
          <Door href="/vehicles" tint="buy" icon={CarFront} label="Buy" sub="Cars for sale" />
          <Door href="/sell" tint="sell" icon={Tag} label="Sell" sub="Sell or swap" />
          <Door href="/check" tint="check" icon={ScanSearch} label="Check VIN" sub="Free check" />
        </nav>
        <div className="hh-links">
          <AskButton className="hh-link">
            <Sparkles aria-hidden size={17} />
            <span>
              Not sure where to start? <strong>Ask Sabicars</strong>
            </span>
          </AskButton>
          <Link href="/partners" className="hh-link">
            <HandCoins aria-hidden size={17} />
            <span>
              Know a buyer? <strong>Earn {REFERRAL_COMMISSION_BPS / 100}%</strong>
            </span>
          </Link>
        </div>
      </HeroSlides>

      {/* Do they have what I want? One field, answered from the stock as they type — or by Ask Sabicars. */}
      <section aria-label="Find your car" className="relative z-10 lg:-mt-10">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <HomeSearch terms={stockTerms.map((t) => ({ slug: t.slug, label: t.label, fromMinor: t.fromMinor }))} shortcuts={shortcuts} hummers={hummers.length > 0} />
        </div>
      </section>

      {/* What do you need? One door per thing a visitor came to do, each with a live line, so nothing Sabicars does is
          hidden under "More" (the owner, 14 November 2026, after the Adedayo home page). */}
      <section className="mx-auto mt-8 max-w-7xl px-5 md:mt-10 md:px-10">
        <h2 className="home-sr">What do you need?</h2>
        <ul className="home-tiles">
          {tilesNeed.map((t, i) => (
            <li key={t.title} style={{ ["--i" as string]: i }}>
              <Link href={t.href} className="home-tile" data-tint={t.tint}>
                <span className="home-tile-top">
                  <span className="home-tile-icon">
                    <t.icon aria-hidden size={22} strokeWidth={2} />
                  </span>
                  {t.photos && t.photos.length > 0 && (
                    <span className="home-tile-photos" aria-hidden="true">
                      {t.photos.map((src, k) => (
                        <span key={`${k}-${src}`} className="home-tile-photo">
                          <VehicleImage src={src} alt="" fill sizes="32px" />
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="home-tile-title">
                  {t.title}
                  <ChevronRight aria-hidden size={16} />
                </span>
                <span className="home-tile-detail figures">{t.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* The Drive Plan's terms are not repeated here: the Drive Plan section below says them once, with its finder
            (the owner, 14 November 2026: "same explanation is in screenshot 2"). */}
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
                {/* One line (the owner, 14 November 2026: "can we summerise it"). The Drive Plan is in the figures just below. */}
                <p>Toyota Hiace Hummer buses for staff, schools, churches and transport. Buy one or many.</p>
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
            {/* No paragraph under the question (the owner, 14 November 2026): "who really needs drive plan will click the link
                to learn more". The two sentences that keep the answer true sit under the cars it finds. */}
            <DrivePlanFinder vehicles={catalogue} brief>
              <ScrollReveal>
                <SectionHead eyebrow="The 40% Drive Plan" title="How much do you have?" />
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
                See all cars for sale
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
                {/* Each card arrives the first time it is seen, on a phone as it is swiped in (the owner, 14 November 2026). */}
                {featured.map((v, i) => (
                  <ScrollReveal key={v.id} card delay={(i % 3) * 110} className="w-[84%] shrink-0 snap-start sm:w-[60%] md:w-auto">
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

      {/* Who you are buying from, in one short block, the way the Adedayo home page does it (the owner, 14 November 2026:
          the founder section "consumes space"): three promises the site already makes, and one card to the founder's story.
          His photo, his quote and the reviews in full are on /about, where "Our story" and the rating lead. */}
      <section aria-labelledby="trust-title" className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ScrollReveal>
            <h2 id="trust-title" className="text-display-3">
              Why people trust us
            </h2>
            <ul className="mt-6 grid gap-4">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-green-500/[0.14] text-green-300 md:size-14">
                    <t.icon aria-hidden size={22} strokeWidth={2} />
                  </span>
                  <span className="text-[1.08rem] font-semibold leading-snug text-text-primary md:text-[1.2rem]">{t.text}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={120} className="grid gap-4">
            <Link
              href="/about"
              className="group flex items-center gap-4 rounded-[2rem] border border-white/[0.08] bg-surface-1 p-3 pr-5 transition-colors duration-[var(--duration-fast)] hover:border-border-strong md:p-4 md:pr-6"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-surface-2 md:size-20">
                <Image src="/founder.jpg" alt="" fill sizes="80px" className="object-cover object-[60%_25%]" />
              </span>
              <span className="min-w-0 flex-1">
                {/* One line where there is room; on a phone the fact takes its own line instead of leaving the dot behind. */}
                <span className="block font-semibold leading-snug text-text-primary">
                  Founded by Ccristian Dee{" "}
                  <span className="figures block font-medium text-text-secondary sm:inline">
                    <span className="hidden sm:inline">· </span>
                    {FOUNDER_FACT}
                  </span>
                </span>
                <span className="mt-1 block font-semibold text-green-300 group-hover:text-green-200">Our story</span>
              </span>
              <ChevronRight aria-hidden size={20} className="shrink-0 text-text-muted transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5" />
            </Link>
            {/* The reviews in brief: the rating and where to read them all, on /about. */}
            {reviewStats.count > 0 && reviewStats.average !== null && (
              <Link
                href="/about#reviews"
                className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-1 py-2 text-text-secondary transition-colors hover:text-text-primary"
              >
                <span className="figures font-semibold text-text-primary">{reviewStats.average.toFixed(1)}</span>
                <Stars rating={reviewStats.average} size={16} />
                <span className="figures">
                  {reviewStats.count} {reviewStats.count === 1 ? "review" : "reviews"}
                </span>
                <span className="font-semibold text-green-300 group-hover:text-green-200">Read them</span>
              </Link>
            )}
          </ScrollReveal>
        </div>
        {/* The day's video from the park, with his line for the day, when one is set. */}
        {video && (
          <div className="mx-auto max-w-7xl px-5 pb-14 md:px-10 md:pb-20">
            <ScrollReveal>
              <TodayVideo video={video} />
            </ScrollReveal>
          </div>
        )}
      </section>

      {/* Can I earn from this? The three promises, the way in, and a row of cars at the park with what one buyer earns on each:
          every car counts, not one. The rules in full are on /partners, one tap away (the owner's review, 2026-11-06). */}
      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
          <ScrollReveal className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
            <div>
              <SectionHead eyebrow="Earn" title="Know a buyer? Earn 1.5% when they buy." />
              <PartnerPromises className="mt-6" />
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <ButtonLink href="/partners#register" size="lg">
                Get your free link
              </ButtonLink>
              <ButtonLink href="/partners" variant="quiet">
                How it works
              </ButtonLink>
            </div>
          </ScrollReveal>
          <div className="mt-10">
            <EarningsRow vehicles={catalogue} />
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
            {/* Short cards, the picture beside the headline, the way the Adedayo home page lists its guides: one under another
                on a phone and a tablet, three across on a desktop. The old tall card took a phone's whole screen for one guide
                (the owner, 14 November 2026: "our article card is too long"). */}
            <div className="mt-8 grid gap-3 md:mt-12 lg:grid-cols-3 lg:gap-5">
              {posts.map((p, i) => (
                <ScrollReveal key={p.slug} card delay={i * 110} className="h-full">
                  <PostCard post={p} size="sm" />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Visit or call, the way the Adedayo home page ends (the owner, 14 November 2026): the park and the way there, the
          hours, the email, then one button to call and one to write. The footer under it keeps only a one-line address. */}
      <section aria-labelledby="visit-title" className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ScrollReveal>
            <h2 id="visit-title" className="text-display-3">
              Visit or call
            </h2>
            <ul className="mt-6 grid gap-5 text-text-secondary">
              <li className="flex gap-4">
                <MapPin aria-hidden size={20} className="mt-1 shrink-0 text-green-300" />
                <div>
                  <Address className="text-text-primary" />
                  <a
                    href={site.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold text-green-300 underline decoration-green-300/40 underline-offset-4 hover:text-green-200 hover:decoration-green-200"
                  >
                    Get directions<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              </li>
              <li className="flex gap-4">
                <Clock aria-hidden size={20} className="mt-1 shrink-0 text-green-300" />
                {/* Short day names, and the time kept whole, so each line fits a 310px phone: "Mon – Fri  8:00am – 7:00pm". */}
                <p className="figures leading-relaxed">
                  {site.hours.map((h) => (
                    <span key={h.days} className="block">
                      {h.days.replace(/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/g, (_, d: string) => d.slice(0, 3))}{" "}
                      <span className="whitespace-nowrap text-text-primary">{h.time}</span>
                    </span>
                  ))}
                </p>
              </li>
              <li className="flex items-center gap-4">
                <Mail aria-hidden size={20} className="shrink-0 text-green-300" />
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex min-h-11 items-center font-semibold text-green-300 underline decoration-green-300/40 underline-offset-4 hover:text-green-200 hover:decoration-green-200"
                >
                  {site.email}
                </a>
              </li>
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={120} className="grid gap-3 sm:max-w-sm lg:w-full lg:justify-self-end">
            <ButtonAnchor href={`tel:${site.phones[0].e164}`} size="lg" className="w-full">
              <Phone aria-hidden size={18} /> Call <span className="figures">{site.phones[0].display}</span>
            </ButtonAnchor>
            <ButtonLink href="/contact" variant="secondary" size="lg" className="w-full">
              Send a message
            </ButtonLink>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}

/** One of the hero's three doors: an icon chip, a short name and one fact (styles/home.css, .hh-btn). */
function Door({ href, tint, icon: Icon, label, sub }: { href: string; tint: string; icon: LucideIcon; label: string; sub: string }) {
  return (
    <Link href={href} className="hh-btn" data-tint={tint}>
      <span className="hh-btn-chip">
        <Icon aria-hidden size={16} strokeWidth={2} />
      </span>
      <span className="hh-btn-label">
        {label}
        <span className="home-sr">, </span>
      </span>
      <span className="hh-btn-sub figures">{sub}</span>
    </Link>
  );
}
