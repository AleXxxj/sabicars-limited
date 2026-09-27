import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ComparePicker } from "@/components/compare/ComparePicker";
import { PageIntro } from "@/components/site/PageIntro";
import { comparisonPairs } from "@/lib/compare";
import { listedVehicles } from "@/lib/repositories/vehicles";
import { BODY_LABEL, priceLabel, vehicleTitle } from "@/lib/vehicle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Compare cars side by side",
  description:
    "Compare any cars in the Sabicars showroom side by side — price, 40% Drive Plan deposit, year, mileage, engine, seats and features — and see which one suits you.",
  alternates: { canonical: "/compare" },
};

export default async function CompareIndex() {
  const [stock, pairs] = await Promise.all([listedVehicles(), comparisonPairs()]);
  const cars = stock.map((v) => ({
    slug: v.slug,
    title: vehicleTitle(v),
    price: priceLabel(v),
    body: v.body ? BODY_LABEL[v.body] : "Other",
  }));
  const groups = [...new Set(pairs.map((p) => p.body))];

  return (
    <>
      <PageIntro eyebrow="Compare" title="Two cars. One honest answer.">
        Pick any two or three cars in the showroom and see them side by side: price, what you would put down on the Drive Plan, age,
        mileage, engine, seats and features — and which one suits you.
      </PageIntro>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 className="kicker">Choose your own</h2>
          <div className="mt-6">
            <ComparePicker cars={cars} />
          </div>
        </div>
        <div>
          <h2 className="kicker">Popular comparisons</h2>
          <div className="mt-6 grid gap-8">
            {groups.map((g) => (
              <div key={g}>
                <h3 className="text-sm font-semibold text-text-muted">{g}</h3>
                <ul className="mt-3 grid gap-2">
                  {pairs
                    .filter((p) => p.body === g)
                    .map((p) => (
                      <li key={p.path}>
                        <Link
                          href={p.path}
                          className="group flex min-h-12 items-center justify-between gap-3 border-b border-border-subtle py-2 text-text-primary hover:text-gold-200"
                        >
                          {p.title}
                          <ArrowRight
                            aria-hidden
                            size={16}
                            className="shrink-0 text-gold-300 transition-transform group-hover:translate-x-1"
                          />
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
