import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PageIntro } from "@/components/site/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { formatNaira, money, percentOf } from "@/lib/money";
import { searchTerms, vehiclesForTerm } from "@/lib/repositories/vehicles";
import { termHref } from "@/lib/seo/search-terms";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { DRIVE_PLAN_DEPOSIT_BPS, vehicleTitle } from "@/lib/vehicle";

export const revalidate = 300;

type Props = { params: Promise<{ term: string }> };

export async function generateStaticParams() {
  return (await searchTerms()).map((t) => ({ term: t.slug }));
}

async function find(slug: string) {
  const all = await searchTerms();
  return { term: all.find((t) => t.slug === slug), all };
}

/** "Toyota Highlander" for a model; "Toyota cars, SUVs and buses" reads badly, so a make page is "Toyota vehicles". */
const noun = (t: { label: string; family: string | null }) => (t.family ? t.label : `${t.label} vehicles`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term } = await find((await params).term);
  if (!term) return { title: "Not found" };
  const from = term.fromMinor ? ` from ${formatNaira(term.fromMinor, { compact: true })}` : "";
  return {
    title: `${noun(term)} for sale in Lagos`,
    description: term.inStock
      ? `${noun(term)} for sale in Lagos: ${term.inStock} in stock at Sabicars${from} — photographed, priced and ready to inspect, with the 40% Drive Plan and fleet supply. CAC RC 1560100.`
      : `${noun(term)} for sale in Lagos: tell Sabicars the year and budget you want and hear the moment one arrives.`,
    alternates: { canonical: termHref(term.slug) },
    // A sold-out family keeps its page for people who search for it, but is not offered to search engines empty.
    robots: term.inStock ? undefined : { index: false, follow: true },
  };
}

/**
 * A search landing page: "Toyota Highlander for sale in Lagos".
 *
 * Its one job: be the result a buyer lands on when they search for a model
 * Sabicars stocks — and from there, a car page or a Sourcing Desk request.
 * One page per make and per model family, generated from the stock itself,
 * so a newly listed model gets its page without anyone writing it.
 */
export default async function TermPage({ params }: Props) {
  const slug = (await params).term;
  if (termHref(slug) !== `/buy/${slug}`) permanentRedirect(termHref(slug));
  const { term, all } = await find(slug);
  if (!term) notFound();

  const cars = await vehiclesForTerm(term);
  const title = `${noun(term)} for sale in Lagos`;
  const cover = cars.find((c) => c.cover)?.cover?.url ?? null;
  const deposit = term.fromMinor ? percentOf(money(term.fromMinor, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor : null;
  const related = term.family
    ? all.filter((t) => t.make === term.make && t.family && t.slug !== term.slug && t.inStock > 0)
    : all.filter((t) => t.make === term.make && t.family && t.inStock > 0);
  const makeTerm = all.find((t) => t.make === term.make && !t.family);
  const trail = [
    { name: "Home", path: "/" },
    { name: "Inventory", path: "/vehicles" },
    ...(term.family && makeTerm ? [{ name: term.make, path: termHref(makeTerm.slug) }] : []),
    { name: term.family ?? term.make, path: termHref(term.slug) },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd(trail),
            itemListJsonLd(title, cars.map((c) => ({ name: vehicleTitle(c), path: `/vehicles/${c.slug}` }))),
          ]),
        }}
      />
      <PageIntro eyebrow={term.inStock ? `${term.inStock} in stock · Lagos` : "For sale in Lagos"} title={title} imageUrl={cover}>
        <p>
          {term.inStock ? (
            <>
              {term.inStock === 1 ? "One" : term.inStock} {term.inStock === 1 ? "is" : "are"} in the Sabicars showroom now
              {term.fromMinor ? <>, from {formatNaira(term.fromMinor)}</> : null}
              {deposit ? <> — or {formatNaira(deposit)} down on the 40% Drive Plan</> : null}. Every one photographed, priced and
              ready to inspect before you pay.
            </>
          ) : (
            <>None in stock this week. Tell Sabicars the year and budget you want, and hear the moment one arrives.</>
          )}
        </p>
      </PageIntro>

      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <ol className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          {trail.map((t, i) => (
            <li key={t.path} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>›</span>}
              {i === trail.length - 1 ? (
                <span aria-current="page" className="text-text-secondary">
                  {t.name}
                </span>
              ) : (
                <Link href={t.path} className="hover:text-text-primary">
                  {t.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
        {cars.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cars.map((v, i) => (
              <ScrollReveal key={v.id} delay={(i % 3) * 80}>
                <VehicleCard vehicle={v} href={`/vehicles/${v.slug}`} priority={i < 3} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="text-lg text-text-primary">No {noun(term)} in the showroom right now.</p>
            <p className="mt-2 text-text-secondary">Put one on the Sourcing Desk and you will hear the moment one arrives.</p>
          </div>
        )}

        <div className="surface-card mt-12 flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
          <div>
            <p className="text-lg font-semibold text-text-primary">Want a different year, colour or budget?</p>
            <p className="mt-1 text-text-secondary">Tell the Sourcing Desk and hear the moment a {term.family ? term.label : `${term.make}`} that fits arrives.</p>
          </div>
          <ButtonLink href={`/find?want=${encodeURIComponent(term.label)}`}>Find me one</ButtonLink>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
            <p className="kicker">{term.family ? `More ${term.make} for sale` : `${term.make} models in stock`}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {related.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={termHref(t.slug)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-default bg-surface-1 px-4 text-sm text-text-secondary transition-colors hover:border-gold-500/40 hover:text-text-primary"
                  >
                    {t.label} <span className="figures text-text-muted">{t.inStock}</span>
                  </Link>
                </li>
              ))}
              {term.family && makeTerm && (
                <li>
                  <Link href={termHref(makeTerm.slug)} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-gold-300 hover:text-gold-200">
                    All {term.make} →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
