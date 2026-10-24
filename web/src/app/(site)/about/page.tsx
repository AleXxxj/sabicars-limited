import type { Metadata } from "next";
import Image from "next/image";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Address } from "@/components/site/Address";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { publishedReviews, reviewSummary } from "@/lib/repositories/reviews";
import { inventoryStats } from "@/lib/repositories/vehicles";
import { pageAddress, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Sabicars — founded by Ccristian Dee",
  description:
    `${site.legalName} (RC ${site.rcNumber}) was founded by Ccristian Dee — Prince Emmanuel Abisoye — on a simple principle: Nigerian car buyers deserve dealers who tell the truth about what they sell.`,
  ...pageAddress("/about"),
};

/**
 * Written from what Sabicars already publishes about itself. Figures that the
 * business has not yet confirmed (specific fleet orders, years trading, sales
 * totals) are left out until it does — an institution states only what it can
 * stand behind.
 */
const STANDARDS = [
  {
    title: "Registered and responsible",
    body: `${site.legalName} is registered with the Corporate Affairs Commission under RC ${site.rcNumber}. It is a real company that answers for what it sells, not a roadside stand.`,
    link: { href: site.cacSearchUrl, label: "Check it on the CAC register" },
  },
  {
    title: "See it before you pay",
    body: "Walk in and inspect the cars at our showroom before any money changes hands.",
    link: { href: site.mapsUrl, label: "Directions to the showroom" },
  },
  {
    title: "Exactly as described",
    body: "Every vehicle is listed with its own photographs, its details and its price. The car you get is the car in the photos.",
    link: { href: "/vehicles", label: "See cars for sale" },
  },
  {
    title: "Every enquiry on record",
    body: "Each enquiry gets a reference number. Whoever you speak to can see which car and which conversation you mean.",
    link: { href: "/contact", label: "Talk to us" },
  },
];

export default async function AboutPage() {
  const [stats, reviews, reviewStats] = await Promise.all([inventoryStats(), publishedReviews(), reviewSummary()]);

  return (
    <>
      <PageIntro eyebrow="About Sabicars" title="A dealer that tells the truth about what it sells.">
        <p>
          Ccristian Dee started {site.legalName} with one simple belief: Nigerian car buyers deserve dealers who tell the truth about
          what they sell.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <ScrollReveal className="lg:sticky lg:top-28">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
            <Image src="/founder.jpg" alt={`Ccristian Dee, founder of ${site.legalName}`} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
          </div>
          <p className="mt-4 font-medium">Ccristian Dee</p>
          <p className="text-sm text-text-muted">Born Prince Emmanuel Abisoye · Founder &amp; CEO</p>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <p className="kicker">The founder</p>
          <h2 className="mt-4 text-display-2">From one car at a time to a registered company.</h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-text-secondary">
            <p>
              Ccristian Dee started Sabicars small, selling one vehicle at a time. He was born Prince Emmanuel Abisoye, and many know
              him as Ccrist D.
            </p>
            <p>
              Today it is a company registered with the Corporate Affairs Commission (RC {site.rcNumber}). People buying one car trust
              it, and so do companies buying many, in Lagos and beyond. Every order gets the same care, big or small.
            </p>
            <p>
              Sabicars sells from its Lagos showroom and online. You can buy on the 40% Drive Plan, with a loan through Autochek.
              Companies and government offices can buy in bulk.
            </p>
          </div>
          <blockquote className="mt-12 border-l-2 border-green-500 pl-6">
            <p className="font-display text-[1.7rem] leading-snug md:text-[2rem]">
              “Every vehicle that leaves our showroom carries my name on it … That’s not a slogan, it’s how I built this.”
            </p>
            <footer className="mt-4 text-sm text-text-muted">— Ccristian Dee</footer>
          </blockquote>
        </ScrollReveal>
      </section>

      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
            <div className="max-w-2xl">
              <p className="kicker">Our promises</p>
              <h2 className="mt-4 text-display-2">What buying from Sabicars means.</h2>
              <p className="mt-5 text-lg leading-relaxed text-text-secondary">
                The Sabicars Verified seal means our team has inspected the car at our showroom. It stands for these four promises and
                shows our registration number, so anyone can check us. A car we list from somewhere else can be inspected if you ask,
                but it does not get the seal.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a vector seal, cached across pages; nothing for next/image to optimise */}
            <img src="/brand/seal.svg" alt={`The ${site.name} Verified seal, with CAC RC ${site.rcNumber}`} width={168} height={168} className="size-36 md:size-42" />
          </ScrollReveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-border-subtle sm:grid-cols-2">
            {STANDARDS.map((s, i) => (
              <ScrollReveal key={s.title} delay={(i % 2) * 90} className="bg-surface-1 p-6 md:p-10">
                <p className="figures text-xs text-text-muted">0{i + 1}</p>
                <h3 className="mt-2 text-[1.6rem] font-semibold leading-tight font-sans tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-text-secondary">{s.body}</p>
                <a
                  href={s.link.href}
                  {...(s.link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-green-300 hover:text-green-200 mt-4"
                >
                  {s.link.label} →
                </a>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <ReviewsSection reviews={reviews} summary={reviewStats} />

      <section className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:items-end">
          <ScrollReveal>
            <p className="kicker">Today</p>
            <p className="figures mt-4 font-display text-[3.5rem] leading-none md:text-[4.5rem]">{stats.inStock}</p>
            <p className="mt-3 text-lg text-text-secondary">vehicles in stock right now, from {stats.makes} brands.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/vehicles">See cars for sale</ButtonLink>
              <ButtonLink href="/contact" variant="secondary">
                Visit or get in touch
              </ButtonLink>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={120} className="text-text-secondary">
            <p className="text-sm font-medium text-text-muted">The showroom</p>
            <Address className="mt-3" />
            <ul className="mt-5 space-y-1 text-sm">
              {site.hours.map((h) => (
                <li key={h.days}>
                  {h.days}: <span className="figures text-text-primary">{h.time}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
