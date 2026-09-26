import type { Metadata } from "next";
import Image from "next/image";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Address } from "@/components/site/Address";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { publishedReviews, reviewSummary } from "@/lib/repositories/reviews";
import { inventoryStats } from "@/lib/repositories/vehicles";
import { site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Sabicars — founded by Ccristian Dee",
  description:
    "Sabicars Limited (RC 1560100) was founded by Ccristian Dee — Prince Emmanuel Abisoye — on a simple principle: Nigerian car buyers deserve dealers who tell the truth about what they sell.",
  alternates: { canonical: "/about" },
};

/**
 * Written from what Sabicars already publishes about itself. Figures that the
 * business has not yet confirmed (specific fleet orders, years trading, sales
 * totals) are left out until it does — an institution states only what it can
 * stand behind.
 */
const STANDARDS = [
  {
    title: "Registered and accountable",
    body: `Sabicars Limited is registered with the Corporate Affairs Commission under RC ${site.rcNumber} — a company you can hold to account, not a roadside stand.`,
    link: { href: site.cacSearchUrl, label: "Check it on the CAC register" },
  },
  {
    title: "See it before you pay",
    body: "Walk in and inspect any vehicle in person before any money changes hands.",
    link: { href: site.mapsUrl, label: "Directions to the showroom" },
  },
  {
    title: "Exactly as described",
    body: "Every vehicle is listed with its own photographs, its specification and its price. What you see is what you get on delivery.",
    link: { href: "/vehicles", label: "See the inventory" },
  },
  {
    title: "Every enquiry on record",
    body: "Each enquiry is saved with a reference, so whoever you speak to knows exactly which vehicle and which conversation you mean.",
    link: { href: "/contact", label: "Talk to us" },
  },
];

export default async function AboutPage() {
  const [stats, reviews, reviewStats] = await Promise.all([inventoryStats(), publishedReviews(), reviewSummary()]);

  return (
    <>
      <PageIntro eyebrow="About Sabicars" title="A dealer that tells the truth about what it sells.">
        <p>
          Sabicars Limited was founded by Ccristian Dee on a simple principle: Nigerian car buyers deserve dealers who tell the truth
          about what they are selling.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-10 md:py-28 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <ScrollReveal className="lg:sticky lg:top-28">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
            <Image src="/founder.jpg" alt="Ccristian Dee, founder of Sabicars Limited" fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover object-[60%_center]" />
          </div>
          <p className="mt-4 font-medium">Ccristian Dee</p>
          <p className="text-sm text-text-muted">Born Prince Emmanuel Abisoye · Founder &amp; CEO</p>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <p className="kicker">The founder</p>
          <h2 className="mt-4 text-display-2">From single vehicles to a registered company.</h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-text-secondary">
            <p>
              Ccristian Dee — born Prince Emmanuel Abisoye, and known to many as Ccrist D — started Sabicars as a small operation
              moving individual vehicles.
            </p>
            <p>
              That operation has grown into a company registered with the Corporate Affairs Commission (RC {site.rcNumber}), trusted by
              individual buyers and by corporate fleet clients across Lagos and beyond — every order held to the same standard,
              whatever its size.
            </p>
            <p>
              Today Sabicars sells from its Lagos showroom and online — with the 40% Drive Plan, financed with Autochek, and fleet
              supply for companies and government.
            </p>
          </div>
          <blockquote className="mt-12 border-l-2 border-gold-500 pl-6">
            <p className="font-display text-[1.7rem] leading-snug md:text-[2rem]">
              “Every vehicle that leaves our plaza carries my name on it — accident-free, verified, and exactly as described. That’s not
              a slogan, it’s how I built this.”
            </p>
            <footer className="mt-4 text-sm text-text-muted">— Ccristian Dee</footer>
          </blockquote>
        </ScrollReveal>
      </section>

      <section className="border-t border-border-subtle bg-surface-1">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
          <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
            <div className="max-w-2xl">
              <p className="kicker">The standard</p>
              <h2 className="mt-4 text-display-2">What buying from Sabicars means.</h2>
              <p className="mt-5 text-lg leading-relaxed text-text-secondary">
                The Sabicars Verified seal stands for these four promises — and carries the registration number anyone can check.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a vector seal, cached across pages; nothing for next/image to optimise */}
            <img src="/brand/seal-gold.svg" alt="The Sabicars Verified seal, with CAC RC 1560100" width={168} height={168} className="size-36 md:size-42" />
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
                  className="group inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-gold-300 hover:text-gold-200 mt-4"
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
            <p className="mt-3 text-lg text-text-secondary">vehicles in stock right now, across {stats.makes} makes.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/vehicles">View the inventory</ButtonLink>
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
