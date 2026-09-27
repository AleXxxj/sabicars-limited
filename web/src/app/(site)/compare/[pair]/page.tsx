import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { AskButton } from "@/components/assistant/AskButton";
import { SaveButton } from "@/components/saved/SaveButton";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleImage } from "@/components/VehicleImage";
import { comparePath } from "@/lib/assistant/parts";
import { compareSummary, compareTitle, comparisonPairs, differences, slugsFromPair, suits } from "@/lib/compare";
import { shareImageUrl } from "@/lib/media";
import { vehiclesWithPages, type VehicleWithCover } from "@/lib/repositories/vehicles";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { drivePlanDeposit, priceLabel, specRows, vehicleTitle } from "@/lib/vehicle";

type Props = { params: Promise<{ pair: string }> };

/** Built for the comparisons the site links to; any other pair is built on its first visit. Refreshed with the stock. */
export const revalidate = 300;

export async function generateStaticParams() {
  return (await comparisonPairs()).map((p) => ({ pair: p.path.replace("/compare/", "") }));
}

async function load(pair: string): Promise<VehicleWithCover[] | null> {
  const slugs = slugsFromPair(pair);
  if (!slugs) return null;
  const cars = await vehiclesWithPages(slugs);
  return cars.length === slugs.length ? cars : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const cars = await load(pair);
  if (!cars) return { title: "Comparison not found" };
  const title = compareTitle(cars);
  const description = `${compareSummary(cars)} ${cars.map((c) => `${vehicleTitle(c)}: ${priceLabel(c)}`).join(" · ")}.`;
  const cover = cars.find((c) => c.cover)?.cover;
  return {
    title: `${title}: price, specs and which to buy`,
    description,
    alternates: { canonical: comparePath(cars.map((c) => c.slug)) },
    // Only a comparison of cars that are still for sale is worth a search result.
    robots: cars.some((c) => c.status === "sold") ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      images: cover ? [{ url: shareImageUrl(cover.url), width: 1200, height: 630, alt: title }] : undefined,
    },
  };
}

/** Every specification either car records, in the order a buyer reads them. */
function specTable(cars: VehicleWithCover[]) {
  const rows = cars.map((c) => new Map(specRows(c).map((r) => [r.label, r.value])));
  const labels = [...new Set(cars.flatMap((c) => specRows(c).map((r) => r.label)))];
  return labels.map((label) => ({ label, values: rows.map((r) => r.get(label) ?? null) }));
}

export default async function ComparePage({ params }: Props) {
  const { pair } = await params;
  const cars = await load(pair);
  if (!cars) notFound();
  const canonical = comparePath(cars.map((c) => c.slug));
  if (`/compare/${pair}` !== canonical) permanentRedirect(canonical);

  const title = compareTitle(cars);
  const facts = differences(cars);
  const fits = suits(cars);
  const table = specTable(cars);
  const featureSets = cars.map((c) => new Set(c.features));
  const allFeatures = [...new Set(cars.flatMap((c) => c.features))];
  const others = (await comparisonPairs()).filter((p) => p.path !== canonical && cars.some((c) => p.path.includes(c.slug))).slice(0, 6);
  const sold = cars.some((c) => c.status === "sold");
  const cols = { gridTemplateColumns: `repeat(${cars.length}, minmax(0, 1fr))` };
  const trail = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/compare" },
    { name: title, path: canonical },
  ];

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            itemListJsonLd(
              title,
              cars.map((c) => ({ name: vehicleTitle(c), path: `/vehicles/${c.slug}` })),
            ),
            breadcrumbJsonLd(trail),
          ]),
        }}
      />

      <header className="mx-auto max-w-7xl px-5 pt-10 md:px-10 md:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/compare" className="hover:text-text-primary">
            Compare
          </Link>{" "}
          <span aria-hidden>›</span> <span className="text-text-secondary">Side by side</span>
        </nav>
        <p className="kicker mt-6">Side by side</p>
        <h1 className="mt-4 max-w-5xl text-display-2">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">{compareSummary(cars)}</p>
        {sold && (
          <p className="mt-6 inline-block rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm font-semibold text-gold-200">
            One of these has been sold. The comparison stays for reference.
          </p>
        )}
      </header>

      {/* The cars, face to face. */}
      <section className="mx-auto mt-10 max-w-7xl px-5 md:px-10">
        <div className="grid gap-4 md:gap-6" style={cols}>
          {cars.map((c) => (
            <div key={c.id} className="surface-card overflow-hidden !rounded-2xl">
              <Link href={`/vehicles/${c.slug}`} className="relative block aspect-[4/3] bg-surface-2">
                {c.cover && (
                  <VehicleImage
                    src={c.cover.url}
                    alt={vehicleTitle(c)}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                )}
                {c.status !== "available" && (
                  <span className="absolute top-3 left-3 rounded-full bg-surface-0/85 px-3 py-1 text-xs font-semibold text-gold-200">
                    {c.status === "sold" ? "Sold" : "Reserved"}
                  </span>
                )}
              </Link>
              <div className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-sans text-[1.05rem] leading-snug font-semibold md:text-xl">
                    <Link href={`/vehicles/${c.slug}`} className="hover:text-gold-200">
                      {vehicleTitle(c)}
                    </Link>
                  </h2>
                  {c.status !== "sold" && <SaveButton slug={c.slug} title={vehicleTitle(c)} className="-mt-1 -mr-1 shrink-0" />}
                </div>
                <p className="figures mt-3 text-lg font-semibold text-gold-300 md:text-2xl">{priceLabel(c)}</p>
                {c.priceMinor && c.status !== "sold" && (
                  <p className="figures mt-1 text-xs text-text-muted md:text-sm">{drivePlanDeposit(c)} down on the Drive Plan</p>
                )}
                <Link
                  href={`/vehicles/${c.slug}`}
                  className="group mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-200"
                >
                  See this car <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What actually separates them. */}
      <section className="mx-auto mt-14 grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <h2 className="kicker">The differences that matter</h2>
          <ul className="mt-6 grid gap-4 text-lg leading-relaxed text-text-secondary">
            {facts.map((f) => (
              <li key={f} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-px w-4 shrink-0 bg-gold-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="surface-card p-6 md:p-8">
          <h2 className="kicker">Which suits you</h2>
          <ul className="mt-5 grid gap-5">
            {fits.map(({ car, reasons }) => (
              <li key={car.id}>
                <p className="font-semibold text-text-primary">{vehicleTitle(car)}</p>
                <p className="mt-1 text-text-secondary">
                  {reasons.length
                    ? `Choose it if ${reasons.slice(0, -1).join(", ")}${reasons.length > 1 ? " or " : ""}${reasons.at(-1)}.`
                    : "Evenly matched on the recorded facts — see it in person."}
                </p>
              </li>
            ))}
          </ul>
          {!sold && (
            <AskButton
              prompt={`Help me choose between the ${cars.map(vehicleTitle).join(" and the ")}`}
              className="group mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border border-gold-500/40 px-5 text-sm font-semibold text-gold-200 hover:border-gold-400 hover:bg-gold-500/[0.06]"
            >
              <Sparkles aria-hidden size={16} /> Still torn? Ask Sabicars
            </AskButton>
          )}
        </div>
      </section>

      {/* Every recorded specification. */}
      <section className="mx-auto mt-16 max-w-7xl px-5 md:px-10">
        <h2 className="kicker">Specifications</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="bg-surface-1">
                <th scope="col" className="w-40 px-4 py-3 text-sm font-medium text-text-muted">
                  <span className="sr-only">Specification</span>
                </th>
                {cars.map((c) => (
                  <th key={c.id} scope="col" className="px-4 py-3 text-sm font-semibold text-text-primary">
                    {vehicleTitle(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/[0.06]">
                <th scope="row" className="px-4 py-3 text-sm font-medium text-text-muted">
                  Price
                </th>
                {cars.map((c) => (
                  <td key={c.id} className="figures px-4 py-3 font-semibold text-text-primary">
                    {priceLabel(c)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-white/[0.06]">
                <th scope="row" className="px-4 py-3 text-sm font-medium text-text-muted">
                  40% Drive Plan deposit
                </th>
                {cars.map((c) => (
                  <td key={c.id} className="figures px-4 py-3 text-text-secondary">
                    {drivePlanDeposit(c) ?? "—"}
                  </td>
                ))}
              </tr>
              {table.map((row) => (
                <tr key={row.label} className="border-t border-white/[0.06]">
                  <th scope="row" className="px-4 py-3 text-sm font-medium text-text-muted">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className={`figures px-4 py-3 ${v ? "text-text-secondary" : "text-text-muted italic"}`}>
                      {v ?? "Not stated"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {allFeatures.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-5 md:px-10">
          <h2 className="kicker">Features</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Feature</th>
                  {cars.map((c) => (
                    <th key={c.id} scope="col">
                      {vehicleTitle(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((f, i) => (
                  <tr key={f} className={i ? "border-t border-white/[0.06]" : ""}>
                    <th scope="row" className="w-40 px-4 py-2.5 text-sm font-medium text-text-secondary">
                      {f}
                    </th>
                    {featureSets.map((set, j) => (
                      <td key={j} className="px-4 py-2.5 text-sm">
                        {set.has(f) ? (
                          <Check aria-label="Listed" size={17} className="text-gold-300" />
                        ) : (
                          <span className="text-text-muted">Not listed</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-text-muted">
            Features as each listing records them. See the car to confirm anything that matters to you.
          </p>
        </section>
      )}

      {!sold && (
        <section className="mx-auto mt-16 max-w-7xl px-5 md:px-10">
          <div className="surface-card flex flex-wrap items-center justify-between gap-6 p-6 md:p-10">
            <div className="max-w-xl">
              <h2 className="text-display-3">See them both in person.</h2>
              <p className="mt-3 text-text-secondary">
                Every car can be inspected at the showroom before any money changes hands — bring your own mechanic if you like.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {cars.map((c) => (
                <ButtonLink key={c.id} href={`/vehicles/${c.slug}#enquire`} variant={c === cars[0] ? "primary" : "secondary"}>
                  Enquire: {c.model}
                </ButtonLink>
              ))}
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-5 md:px-10">
          <h2 className="kicker">Other comparisons</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <li key={o.path}>
                <Link
                  href={o.path}
                  className="surface-card group flex h-full items-center justify-between gap-3 !rounded-2xl p-4 text-sm font-semibold hover:border-gold-500/30"
                >
                  {o.title}
                  <ArrowRight aria-hidden size={16} className="shrink-0 text-gold-300 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
