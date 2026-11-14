import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScopeLists, WHICH_CARS, WHICH_CARS_NOT } from "@/components/check/CheckScope";
import { VinCheck } from "@/components/check/VinCheck";
import { PageIntro } from "@/components/site/PageIntro";
import { inspectAUsedCar } from "@/content/articles/inspect-a-used-car";
import { pageAddress } from "@/lib/site";
import "@/styles/vin-check.css";

export const metadata: Metadata = {
  title: "Check any car: free VIN check",
  description:
    "Free VIN (chassis number) check for cars first sold in America, like most tokunbo Toyota, Lexus and Mercedes. See what the car is, its features, safety recalls for its model and crash-test stars, from United States government records.",
  ...pageAddress("/check"),
};

/** Where to go from here: real pages, each said in the words its own page uses. */
const NEXT = [
  { href: "/blog", title: "Buying guides", text: "Plain guides to choosing and checking a car in Nigeria." },
  { href: "/vehicles", title: "Cars for sale", text: "The cars and buses in our showroom, with their prices." },
  { href: "/find", title: "Request a car", text: "Tell us the car you want. We tell you when one arrives." },
  { href: "/contact", title: "Contact us", text: "Ask us to check a car, or ask us anything." },
];

const textLink = "text-text-secondary underline underline-offset-4 hover:text-text-primary";

/**
 * Check any car: a free VIN (chassis number) check.
 *
 * Its one job: give a buyer a reason to come to Sabicars before they have
 * chosen a car, by telling them the truth about one they are looking at, for
 * free and without asking who they are.
 *
 * The truth includes the limits. The check reads United States government
 * records (lib/vin/nhtsa.ts), so it knows cars first sold in America and
 * nothing else: no Hiace bus, no car built for Japan or the Gulf. And for the
 * cars it does know, it shows the model's recalls, owners' complaints and
 * crash-test stars, never this one car's accidents, flood damage, mileage or
 * theft record. Both limits are on the page before a number is typed and
 * again under every result (components/check/CheckScope.tsx), and a car the
 * records do not know gets a plain "we have nothing to show you" with a next
 * step, never an empty result that reads as a clean one.
 */
export default function CheckPage() {
  return (
    <>
      <PageIntro eyebrow="Free VIN check" title="Check any car.">
        <p>
          Type the VIN (chassis number) of a car first sold in America. See what the car is, its features, the safety recalls for its model
          and its crash-test stars. It is free.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-12 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        {/* The box first, on a phone too: it is why the visitor came. The line under its button says what it cannot show. */}
        <div className="min-w-0">
          <VinCheck />
        </div>

        <aside aria-labelledby="check-knows" className="lg:sticky lg:top-28 lg:self-start">
          <p className="kicker">What this check knows</p>
          <h2 id="check-knows" className="mt-4 text-display-3">
            It reads United States records.
          </h2>
          <p className="mt-5 text-text-secondary">{WHICH_CARS}</p>
          <p className="mt-3 text-text-secondary">{WHICH_CARS_NOT}</p>
          <div className="surface-card mt-8 p-6 md:p-7">
            <ScopeLists />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-text-muted">
            Is your car not in the US records, or do you need more than this check can show?{" "}
            <Link href="/contact" className={textLink}>
              Ask us to check it
            </Link>
            , or{" "}
            <Link href="/vehicles" className={textLink}>
              see cars we have checked
            </Link>
            .
          </p>
        </aside>
      </section>

      <section aria-labelledby="check-next" className="border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
          <p className="kicker" id="check-next">
            Helpful next
          </p>
          {/* The guide's own title, from the article itself, so the link can never promise what the guide does not say. */}
          <p className="mt-5 max-w-2xl text-text-secondary">
            A VIN check is one part of checking a car. For the rest, read{" "}
            <Link href={`/blog/${inspectAUsedCar.slug}`} className={textLink}>
              {inspectAUsedCar.title}
            </Link>
            .
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NEXT.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="surface-card group flex h-full flex-col p-6 transition-colors hover:!border-green-500/40">
                  <span className="font-display text-[1.35rem] leading-tight text-text-primary">{n.title}</span>
                  <span className="mb-5 mt-2 text-sm leading-relaxed text-text-secondary">{n.text}</span>
                  <ArrowRight
                    aria-hidden
                    size={18}
                    className="mt-auto text-accent-text transition-transform duration-[var(--duration-base)] group-hover:translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
