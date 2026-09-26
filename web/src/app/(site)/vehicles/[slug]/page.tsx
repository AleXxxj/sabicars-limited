import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { EnquiryForm } from "@/components/vehicle/EnquiryForm";
import { DrivePlanApply } from "@/components/vehicle/DrivePlanApply";
import { SaveButton } from "@/components/saved/SaveButton";
import { WatchForm } from "@/components/saved/WatchForm";
import { Gallery } from "@/components/vehicle/Gallery";
import { listedVehicleSlugs, similarVehicles, vehicleBySlug } from "@/lib/repositories/vehicles";
import { shareImageUrl } from "@/lib/media";
import { dealerJsonLd, jsonLdScript, vehicleJsonLd } from "@/lib/seo/structured-data";
import { site, siteUrl, whatsappLink } from "@/lib/site";
import { drivePlanBalance, drivePlanDeposit, priceLabel, specLine, specRows, vehicleTitle } from "@/lib/vehicle";

type Props = { params: Promise<{ slug: string }> };

/**
 * Pre-built at deploy so every vehicle loads instantly, refreshed every five
 * minutes; staff edits refresh a page immediately (revalidatePath in the admin
 * actions). A car listed after the deploy is built on its first visit.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  return (await listedVehicleSlugs()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await vehicleBySlug((await params).slug);
  if (!found) return { title: "Vehicle not found" };
  const { vehicle: v, media } = found;
  const title = vehicleTitle(v);
  const cover = media.find((m) => m.kind === "photo");
  const description = [
    `${title} for sale in Lagos — ${priceLabel(v)}.`,
    specLine(v),
    v.priceMinor ? `Drive it home with 40% down (${drivePlanDeposit(v)}).` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    description,
    alternates: { canonical: `/vehicles/${v.slug}` },
    // A sold car keeps its page for anyone holding the link, but is not offered
    // to search engines as something to buy.
    robots: v.status === "sold" ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${title} · ${priceLabel(v)}`,
      description,
      type: "website",
      images: cover ? [{ url: shareImageUrl(cover.url), width: 1200, height: 630, alt: title }] : undefined,
    },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border-subtle py-12 md:py-16">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 md:px-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <h2 className="kicker self-start">{title}</h2>
        <div>{children}</div>
      </div>
    </section>
  );
}

export default async function VehiclePage({ params }: Props) {
  const found = await vehicleBySlug((await params).slug);
  if (!found) notFound();
  const { vehicle: v, media, location } = found;

  const title = vehicleTitle(v);
  const url = `${siteUrl()}/vehicles/${v.slug}`;
  const photos = media.filter((m) => m.kind === "photo").map((m) => ({ url: m.url, alt: m.alt ?? title }));
  const specs = specRows(v);
  const deposit = drivePlanDeposit(v);
  const balance = drivePlanBalance(v);
  const sold = v.status === "sold";
  const similar = await similarVehicles(v);

  return (
    <article className="pb-24 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(vehicleJsonLd(v, media, url)) }}
      />

      <div className="mx-auto max-w-7xl px-5 pt-6 md:px-10 md:pt-10">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/vehicles" className="hover:text-text-primary">
            Inventory
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <Link href={`/vehicles?make=${encodeURIComponent(v.make)}`} className="hover:text-text-primary">
            {v.make}
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <span className="text-text-secondary">{v.model}</span>
        </nav>

        {/* minmax(0, …) on every column: a grid track otherwise grows to its
            widest child, and twelve thumbnails in a row are 1,000px wide. */}
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
          <Gallery images={photos} title={title} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            {v.status !== "available" && (
              <p className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm font-semibold text-gold-200">
                {sold ? "This vehicle has been sold" : "Reserved — a buyer has placed a deposit"}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.95rem] font-medium text-text-muted">
                {v.year} · {v.make}
              </p>
              {!sold && <SaveButton slug={v.slug} title={title} variant="labelled" />}
            </div>
            <h1 className="mt-3 text-display-2">{v.model}</h1>
            <p className="mt-3 text-text-secondary">{specLine(v)}</p>

            <div className="mt-8 border-y border-white/[0.06] py-6">
              <p className="text-sm font-medium text-text-muted">Price</p>
              <p className="figures mt-2 text-[2rem] font-semibold leading-none tracking-tight">{priceLabel(v)}</p>
            </div>

            {deposit && balance && !sold && (
              <div className="surface-card relative mt-6 overflow-hidden p-6">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gold-500/12 blur-3xl" />
                <p className="kicker">40% Drive Plan</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-text-muted">Your 40% deposit</dt>
                    <dd className="figures mt-1 text-lg font-semibold text-accent-text">{deposit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">60%, financed by Autochek</dt>
                    <dd className="figures mt-1 text-lg font-semibold">{balance}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-text-muted">Autochek profiles you and approves the financing; the loan terms are set on its listing.</p>
                <DrivePlanApply vehicleId={v.id} autochekUrl={v.autochekUrl} />
                <Link href="/drive-plan" className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200">
                  How the Drive Plan works <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {sold ? (
                <ButtonLink href="#similar" size="lg">
                  See similar vehicles
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="#enquire" size="lg">
                    Enquire about this vehicle
                  </ButtonLink>
                  <ButtonLink href="#enquire" size="lg" variant="secondary">
                    Book a viewing
                  </ButtonLink>
                </>
              )}
            </div>

            {/* For the buyer who is not ready yet: a reason to come back, on its own. */}
            <div className="mt-6 grid gap-2">
              {!sold && v.priceMinor && (
                <details className="surface-card group !rounded-2xl p-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text-primary">
                    <span className="flex items-center gap-2">
                      <BellRing aria-hidden size={17} className="text-gold-300" /> Not ready yet? Get an alert if the price drops
                    </span>
                    <span aria-hidden className="text-gold-300 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="mt-4">
                    <WatchForm slugs={[v.slug]} landingPath={`/vehicles/${v.slug}`} compact />
                  </div>
                </details>
              )}
              <Link
                href={`/find?want=${encodeURIComponent(`${v.make} ${v.model}`)}`}
                className="surface-card group flex items-center justify-between gap-3 !rounded-2xl p-4 text-sm font-semibold text-text-primary hover:border-gold-500/30"
              >
                <span className="flex items-center gap-2">
                  <Search aria-hidden size={17} className="text-gold-300" /> {sold ? "Tell me when another one arrives" : "Want a different year or colour? Tell us"}
                </span>
                <ArrowRight aria-hidden size={16} className="text-gold-300 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <ul className="mt-8 space-y-2 text-sm text-text-secondary">
              <li>
                Sold by {site.legalName} · CAC RC {site.rcNumber}
              </li>
              {location && (
                <li>
                  See it in person: {location.addressLine1}, {location.addressLine2 ? `${location.addressLine2}, ` : ""}
                  {location.city}
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-14">
        {specs.length > 0 && (
          <Section title="Specifications">
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {specs.map((s) => (
                <div key={s.label} className="flex justify-between gap-6 border-b border-border-subtle py-4">
                  <dt className="text-text-muted">{s.label}</dt>
                  <dd className="figures text-right text-text-primary">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {v.features.length > 0 && (
          <Section title="Features">
            <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
              {v.features.map((f) => (
                <li key={f} className="flex items-baseline gap-3 text-text-secondary">
                  <span aria-hidden className="inline-block h-px w-3 shrink-0 translate-y-[-0.3em] bg-gold-500" />
                  {f}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {v.description && (
          <Section title="About this vehicle">
            <p className="max-w-3xl whitespace-pre-line text-lg leading-relaxed text-text-secondary">{v.description}</p>
          </Section>
        )}

        {!sold && (
          <section id="enquire" className="scroll-mt-24 border-t border-border-subtle bg-surface-1 py-14 md:py-20">
            <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div>
                <p className="kicker">Enquire</p>
                <h2 className="mt-3 text-display-3">Interested in the {v.model}?</h2>
                <p className="mt-5 max-w-md text-text-secondary">
                  Ask anything, or arrange to see it at the showroom. Your enquiry is recorded with a reference, so whoever picks it up
                  knows exactly which vehicle you mean.
                </p>
                <p className="figures mt-8 text-sm text-text-muted">
                  Or call{" "}
                  <a href={`tel:${site.phones[0].e164}`} className="text-text-primary">
                    {site.phones[0].display}
                  </a>
                </p>
              </div>
              <EnquiryForm vehicleId={v.id} vehicleTitle={title} landingPath={`/vehicles/${v.slug}`} whatsappBase={whatsappLink()} />
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section id="similar" className="scroll-mt-24 border-t border-border-subtle py-14 md:py-20">
            <div className="mx-auto max-w-7xl px-5 md:px-10">
              <p className="kicker">You may also consider</p>
              <h2 className="mt-3 text-display-3">Similar vehicles</h2>
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {similar.map((s) => (
                  <VehicleCard key={s.id} vehicle={s} href={`/vehicles/${s.slug}`} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Phones: the price and the next step always within thumb reach. */}
      {!sold && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-border-default bg-surface-0/95 px-5 py-3 backdrop-blur-md lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs text-text-muted">{title}</p>
            <p className="figures truncate font-semibold">{priceLabel(v)}</p>
          </div>
          <ButtonLink href="#enquire" className="shrink-0">
            Enquire
          </ButtonLink>
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript({ "@context": "https://schema.org", ...dealerJsonLd() }) }} />
    </article>
  );
}
