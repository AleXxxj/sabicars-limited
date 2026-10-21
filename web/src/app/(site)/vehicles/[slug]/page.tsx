import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Search, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { EnquiryForm } from "@/components/vehicle/EnquiryForm";
import { DrivePlanApply } from "@/components/vehicle/DrivePlanApply";
import { SaveButton } from "@/components/saved/SaveButton";
import { WatchForm } from "@/components/saved/WatchForm";
import { RecentlyViewed, RecordView } from "@/components/saved/RecentlyViewed";
import { Gallery } from "@/components/vehicle/Gallery";
import { RepaymentEstimate } from "@/components/vehicle/RepaymentEstimate";
import { VerifiedPanel } from "@/components/vehicle/VerifiedPanel";
import { comparePath } from "@/lib/assistant/parts";
import { DRIVE_PLAN, depositMinorFor, depositPercentLabel, drivePlanTerms } from "@/lib/drive-plan";
import { bookedSlots } from "@/lib/leads";
import { liveReportFor } from "@/lib/repositories/inspections";
import { listedVehicleSlugs, similarVehicles, vehicleBySlug } from "@/lib/repositories/vehicles";
import { shareImageUrl } from "@/lib/media";
import { breadcrumbJsonLd, dealerJsonLd, jsonLdScript, vehicleJsonLd } from "@/lib/seo/structured-data";
import { modelFamily, termFor, termHref } from "@/lib/seo/search-terms";
import { pageAddress, site, siteUrl, whatsappLink } from "@/lib/site";
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
    drivePlanDeposit(v) ? `Drive it home with ${depositPercentLabel(v.year)} down (${drivePlanDeposit(v)}).` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title: `${title} for sale in Lagos`,
    description,
    // A sold car keeps its page for anyone holding the link, but is not offered
    // to search engines as something to buy.
    robots: v.status === "sold" ? { index: false, follow: true } : undefined,
    ...pageAddress(`/vehicles/${v.slug}`, {
      title: `${title} · ${priceLabel(v)}`,
      description,
      images: cover ? [{ url: shareImageUrl(cover.url), width: 1200, height: 630, alt: title }] : undefined,
    }),
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
  // Alt text is what Google Images reads: the car, "for sale in Lagos", and which photo.
  const photos = media.filter((m) => m.kind === "photo").map((m, i) => ({ url: m.url, alt: `${title} for sale in Lagos${i ? ` — photo ${i + 1}` : ""}` }));
  const makeTerm = termFor(v.make, null);
  const familyTerm = termFor(v.make, modelFamily(v.make, v.model));
  const trail = [
    { name: "Inventory", path: "/vehicles" },
    { name: v.make, path: termHref(makeTerm.slug) },
    { name: familyTerm.family!, path: termHref(familyTerm.slug) },
    { name: title, path: `/vehicles/${v.slug}` },
  ];
  const specs = specRows(v);
  const deposit = drivePlanDeposit(v);
  const balance = drivePlanBalance(v);
  const terms = drivePlanTerms(v.year);
  // The financed balance in kobo, for the repayment estimate; null when the car cannot go on the plan.
  const depositMinor = depositMinorFor(v.priceMinor, v.year);
  const balanceMinor = depositMinor !== null && v.priceMinor ? v.priceMinor - depositMinor : null;
  const sold = v.status === "sold";
  // A car Sabicars lists but holds elsewhere (a partner's or an owner's): viewed and inspected on
  // request, never under the Sabicars Verified seal, and never "see it at the showroom".
  const offsite = v.heldOffsite;
  const offsiteNotice = "Not at the Sabicars showroom. Viewing and an inspection by the Sabicars team are arranged on request; this car does not carry the Sabicars Verified seal.";
  const [similar, live, taken] = await Promise.all([similarVehicles(v), liveReportFor(v.id), sold ? Promise.resolve({}) : bookedSlots(v.dealerId)]);

  return (
    <article className="pb-20 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript([vehicleJsonLd(v, media, url), breadcrumbJsonLd([{ name: "Home", path: "/" }, ...trail])]) }}
      />

      <div className="mx-auto max-w-7xl px-5 pt-6 md:px-10 md:pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
            {trail.map((t, i) => (
              <li key={t.path} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden>›</span>}
                {i === trail.length - 1 ? (
                  <span aria-current="page" className="text-text-secondary">
                    {v.model}
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

        {/* minmax(0, …) on every column: a grid track otherwise grows to its
            widest child, and twelve thumbnails in a row are 1,000px wide. */}
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
          <Gallery images={photos} title={title} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            {v.status !== "available" && (
              <p className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-200">
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

            {offsite && (
              <p className="mt-4 text-sm leading-relaxed text-text-muted">
                {offsiteNotice}
                {!sold && (
                  <>
                    {" "}
                    <Link href="#enquire" className="text-green-300 underline-offset-4 hover:underline">
                      Ask to see it
                    </Link>
                    .
                  </>
                )}
              </p>
            )}

            {/* The seal is only ever given at the showroom; the repository already withholds it from offsite cars. */}
            {live && !offsite && <VerifiedPanel report={live.report} tally={live.tally} />}

            {deposit && balance && terms.eligible && !sold && (
              <div id="drive-plan" className="surface-card relative mt-6 scroll-mt-24 overflow-hidden p-6">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-green-500/12 blur-3xl" />
                <p className="kicker">The Drive Plan</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-text-muted">Your {terms.depositPercent}% deposit</dt>
                    <dd className="figures mt-1 text-lg font-semibold text-accent-text">{deposit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{terms.financedPercent}%, financed by Autochek</dt>
                    <dd className="figures mt-1 text-lg font-semibold">{balance}</dd>
                  </div>
                </dl>
                {balanceMinor !== null && (
                  <div className="mt-5 border-t border-white/[0.06] pt-5">
                    <RepaymentEstimate balanceMinor={balanceMinor} />
                  </div>
                )}
                <p className="mt-4 text-xs text-text-muted">
                  Once approved, you pay the {terms.depositPercent}% and drive it home. Autochek’s lender assesses you and sets the rate and term.
                </p>
                <DrivePlanApply vehicleId={v.id} autochekUrl={v.autochekUrl} financedPercent={terms.financedPercent} />
                <Link href="/drive-plan" className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-green-300 hover:text-green-200">
                  How the Drive Plan works <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}
            {/* Autochek's lenders do not finance cars this old: say so, rather than leave a buyer wondering where the plan went. */}
            {v.priceMinor && !terms.eligible && !sold && (
              <p className="mt-6 rounded-xl border border-border-default bg-surface-1 px-4 py-3 text-sm leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Cash purchase.</span> Autochek’s lenders do not finance cars older than {DRIVE_PLAN.minYear}, so
                the Drive Plan is not available on this one.{" "}
                <Link href="/drive-plan#finder" className="text-green-300 underline-offset-4 hover:underline">
                  See what your deposit reaches
                </Link>
                .
              </p>
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
                  <ButtonLink href="#book-viewing" size="lg" variant="secondary">
                    Book a viewing
                  </ButtonLink>
                </>
              )}
            </div>

            {/* For the buyer who is not ready yet: a reason to come back, on its own. */}
            <div className="mt-6 grid gap-2">
              {!sold && (
                <AskButton
                  prompt={`Tell me about the ${title}`}
                  className="surface-card group flex items-center justify-between gap-3 !rounded-2xl p-4 text-left text-sm font-semibold text-text-primary hover:border-green-500/30"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles aria-hidden size={17} className="text-green-300" /> Ask Sabicars about this car — answers instantly
                  </span>
                  <ArrowRight aria-hidden size={16} className="text-green-300 transition-transform group-hover:translate-x-1" />
                </AskButton>
              )}
              {!sold && v.priceMinor && (
                <details className="surface-card group !rounded-2xl p-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text-primary">
                    <span className="flex items-center gap-2">
                      <BellRing aria-hidden size={17} className="text-green-300" /> Not ready yet? Get an alert if the price drops
                    </span>
                    <span aria-hidden className="text-green-300 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="mt-4">
                    <WatchForm slugs={[v.slug]} landingPath={`/vehicles/${v.slug}`} compact />
                  </div>
                </details>
              )}
              <Link
                href={`/find?want=${encodeURIComponent(`${v.make} ${v.model}`)}`}
                className="surface-card group flex items-center justify-between gap-3 !rounded-2xl p-4 text-sm font-semibold text-text-primary hover:border-green-500/30"
              >
                <span className="flex items-center gap-2">
                  <Search aria-hidden size={17} className="text-green-300" /> {sold ? "Tell me when another one arrives" : "Want a different year or colour? Tell us"}
                </span>
                <ArrowRight aria-hidden size={16} className="text-green-300 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <ul className="mt-8 space-y-2 text-sm text-text-secondary">
              <li>
                Sold by {site.legalName} · CAC RC {site.rcNumber}
              </li>
              {offsite ? (
                <li>{offsiteNotice}</li>
              ) : (
                location && (
                  <li>
                    See it in person: {location.addressLine1}, {location.addressLine2 ? `${location.addressLine2}, ` : ""}
                    {location.city}
                  </li>
                )
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
                  <span aria-hidden className="inline-block h-px w-3 shrink-0 translate-y-[-0.3em] bg-green-500" />
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
            <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div>
                <p className="kicker">Enquire</p>
                <h2 className="mt-3 text-display-3">Interested in the {v.model}?</h2>
                <p className="mt-5 max-w-md text-text-secondary">
                  {offsite
                    ? "Ask anything, or ask to see it — the Sabicars team arranges the viewing and an inspection on request."
                    : "Ask anything, or arrange to see it at the showroom."}{" "}
                  Your enquiry is recorded with a reference, so whoever picks it up knows exactly which vehicle you mean.
                </p>
                <p className="figures mt-8 text-sm text-text-muted">
                  Or call{" "}
                  <a href={`tel:${site.phones[0].e164}`} className="text-text-primary">
                    {site.phones[0].display}
                  </a>
                </p>
              </div>
              <EnquiryForm
                vehicleId={v.id}
                vehicleTitle={title}
                landingPath={`/vehicles/${v.slug}`}
                whatsappBase={whatsappLink()}
                taken={taken}
                // An offsite car is never "at the showroom": the viewing's place is agreed with the buyer,
                // so the confirmation and calendar file say so instead of naming an address.
                address={
                  offsite
                    ? "a place the Sabicars team will confirm with you"
                    : location
                      ? [location.addressLine1, location.addressLine2, location.city].filter(Boolean).join(", ")
                      : `${site.address.line1}, ${site.address.line2}, ${site.address.city}`
                }
              />
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
              {!sold && (
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="text-text-muted">Compare side by side:</span>
                  {similar.map((s) => (
                    <Link key={s.id} href={comparePath([v.slug, s.slug])} className="group inline-flex min-h-10 items-center gap-1.5 font-semibold text-green-300 hover:text-green-200">
                      {v.model} vs {s.model} <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <RecordView slug={v.slug} />
        <RecentlyViewed exclude={v.slug} className="mx-auto max-w-7xl border-t border-border-subtle px-5 py-14 md:px-10 md:py-20" />
      </div>

      {/* Phones: the price and the next step always within thumb reach — above the tab bar, never under it. */}
      {!sold && (
        <div
          data-ask-dock
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-border-default bg-surface-0/95 px-4 py-2.5 backdrop-blur-md lg:hidden"
        >
          <div className="min-w-0">
            <p className="truncate text-xs text-text-muted">{title}</p>
            <p className="figures truncate font-semibold">{priceLabel(v)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AskButton
              prompt={`Tell me about the ${title}`}
              label={`Ask Sabicars about the ${title}`}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-green-500/40 px-4 text-sm font-semibold text-green-200"
            >
              <Sparkles aria-hidden size={16} /> Ask
            </AskButton>
            <ButtonLink href="#enquire" className="shrink-0">
              Enquire
            </ButtonLink>
          </div>
        </div>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript({ "@context": "https://schema.org", ...dealerJsonLd() }) }} />
    </article>
  );
}
