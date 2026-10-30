import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BellRing, Fuel, Gauge, Phone, Search, Settings2, Sparkles, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { AskButton } from "@/components/assistant/AskButton";
import { ButtonAnchor } from "@/components/ui/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { EnquiryForm } from "@/components/vehicle/EnquiryForm";
import { EnquirySheet } from "@/components/vehicle/EnquirySheet";
import { StickyActions } from "@/components/vehicle/StickyActions";
import { ReplyPromise } from "@/components/site/ReplyPromise";
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
import { listedVehicleSlugs, PAGE_SIZE, similarVehicles, vehicleBySlug } from "@/lib/repositories/vehicles";
import { shareImageUrl } from "@/lib/media";
import { breadcrumbJsonLd, dealerJsonLd, jsonLdScript, vehicleJsonLd } from "@/lib/seo/structured-data";
import { modelFamily, termFor, termHref } from "@/lib/seo/search-terms";
import { pageAddress, site, siteUrl, whatsappLink } from "@/lib/site";
import { CONDITION_LABEL, drivePlanBalance, drivePlanDeposit, priceLabel, specLine, specRows, vehicleTitle } from "@/lib/vehicle";

type Props = { params: Promise<{ slug: string }> };

/**
 * Refreshed every five minutes; staff edits refresh a page immediately
 * (refreshPublicPages in the admin actions).
 */
export const revalidate = 300;

/**
 * Only the 24 newest cars — the inventory's first page — are built at deploy.
 * Building every car would make a deploy with 1,000+ cars slow, for pages
 * nobody may ask for. Every other car (and one listed after the deploy) is
 * built on its first visit and then cached for five minutes like these, so
 * only that first visitor waits. dynamicParams must stay at its default
 * (true): set to false, those cars would answer "not found".
 */
export async function generateStaticParams() {
  return (await listedVehicleSlugs(PAGE_SIZE)).map(({ slug }) => ({ slug }));
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
    { name: "Cars for sale", path: "/vehicles" },
    { name: v.make, path: termHref(makeTerm.slug) },
    { name: familyTerm.family!, path: termHref(familyTerm.slug) },
    { name: title, path: `/vehicles/${v.slug}` },
  ];
  const specs = specRows(v);
  // Condition, fuel, gearbox, mileage: what a buyer reads before anything else, each with its own mark.
  const facts = (
    [
      [BadgeCheck, CONDITION_LABEL[v.condition]],
      [Fuel, v.fuel ? v.fuel.charAt(0).toUpperCase() + v.fuel.slice(1) : null],
      [Settings2, v.transmission === "automatic" ? "Automatic" : v.transmission === "manual" ? "Manual" : null],
      [Gauge, v.mileageKm ? `${v.mileageKm.toLocaleString("en-NG")} km` : null],
    ] as [LucideIcon, string | null][]
  ).filter((f): f is [LucideIcon, string] => Boolean(f[1]));
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
  const offsiteNotice = "This car is not at our showroom. Ask us, and we will arrange for you to see it and for our team to inspect it. It does not have the Sabicars Verified seal.";
  const [similar, live, taken] = await Promise.all([similarVehicles(v), liveReportFor(v.id), sold ? Promise.resolve({}) : bookedSlots(v.dealerId)]);

  return (
    <article className="pb-20 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript([vehicleJsonLd(v, media, url), breadcrumbJsonLd([{ name: "Home", path: "/" }, ...trail])]) }}
      />

      <div className="mx-auto max-w-7xl px-5 pt-6 md:px-10 md:pt-10">
        {/* On a phone the trail would be the first thing on the screen; the car is. */}
        <nav aria-label="Breadcrumb" className="hidden md:block">
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
        {/* On a laptop: the gallery beside a sticky column. On a phone the column dissolves into the grid
            (max-lg:contents) and its header goes first, so the first screen is the car's name, its four
            facts and its price — the way a buyer judges a listing before scrolling — with the photos next. */}
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-8 md:mt-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
          <Gallery images={photos} title={title} />

          <div className="max-lg:contents lg:sticky lg:top-28 lg:self-start">
            <div className="max-lg:-order-1">
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
              <h1 className="mt-2 text-display-3 lg:text-display-2">{v.model}</h1>
              {/* The four facts a buyer asks first, read in a glance. */}
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem] text-text-secondary">
                {facts.map(([Icon, label]) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <Icon aria-hidden size={16} className="shrink-0 text-green-300" /> {label}
                  </li>
                ))}
              </ul>
              <div className="mt-5 lg:mt-6 lg:border-y lg:border-white/[0.06] lg:py-6">
                <p className="text-sm font-medium text-text-muted">Price</p>
                <p className="figures mt-1.5 text-[2rem] font-semibold leading-none tracking-tight">{priceLabel(v)}</p>
              </div>
            </div>

            {/* The next step straight after the price, so it is on the first screen of a laptop too.
                The id is watched by the phone bar, which steps aside while these are on screen.
                Plain anchors, not next/link: a second tap on the same hash must scroll again, and Link's
                same-page navigation does not. */}
            <div id="primary-actions" className="mt-6 flex flex-col gap-3">
              {sold ? (
                <ButtonAnchor href="#similar" size="lg" arrow>
                  See similar vehicles
                </ButtonAnchor>
              ) : (
                <>
                  <ButtonAnchor href="#enquire" size="lg" arrow>
                    Enquire about this vehicle
                  </ButtonAnchor>
                  <ButtonAnchor href="#book-viewing" size="lg" variant="secondary">
                    Book a viewing
                  </ButtonAnchor>
                  <ButtonAnchor href={`tel:${site.phones[0].e164}`} size="lg" variant="secondary" className="max-lg:hidden">
                    <Phone aria-hidden size={18} strokeWidth={1.75} /> Call {site.phones[0].display}
                  </ButtonAnchor>
                </>
              )}
            </div>

            {offsite && (
              <p className="mt-4 text-sm leading-relaxed text-text-muted">
                {offsiteNotice}
                {!sold && (
                  <>
                    {" "}
                    <a href="#ask-question" className="text-green-300 underline-offset-4 hover:underline">
                      Ask to see it
                    </a>
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
                    <dt className="text-xs text-text-muted">{terms.financedPercent}%, paid by a loan through Autochek</dt>
                    <dd className="figures mt-1 text-lg font-semibold">{balance}</dd>
                  </div>
                </dl>
                {/* Folded away, so the deposit and the apply button stay close together; one tap opens it. */}
                <details className="group mt-5 border-t border-white/[0.06] pt-3 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text-primary">
                    Monthly estimate
                    <span aria-hidden className="text-green-300 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  {balanceMinor !== null && (
                    <div className="mt-3">
                      <RepaymentEstimate balanceMinor={balanceMinor} />
                    </div>
                  )}
                  <p className="mt-4 text-xs text-text-muted">
                    Autochek’s lender checks your details and sets your rate and how many months you repay. Once approved, you pay the{" "}
                    {terms.depositPercent}% and drive it home.
                  </p>
                </details>
                <DrivePlanApply vehicleId={v.id} autochekUrl={v.autochekUrl} financedPercent={terms.financedPercent} />
                <Link href="/drive-plan" className="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-green-300 hover:text-green-200">
                  How the Drive Plan works <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}
            {/* Autochek's lenders do not finance cars this old: say so, rather than leave a buyer wondering where the plan went. */}
            {v.priceMinor && !terms.eligible && !sold && (
              <p className="mt-6 rounded-xl border border-border-default bg-surface-1 px-4 py-3 text-sm leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Full payment only.</span> Autochek’s lenders do not give loans on cars older than{" "}
                {DRIVE_PLAN.minYear}. So the Drive Plan is not open for this one.{" "}
                <Link href="/drive-plan#finder" className="text-green-300 underline-offset-4 hover:underline">
                  See cars you can get on the Drive Plan
                </Link>
                .
              </p>
            )}

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

        {similar.length > 0 && (
          <section id="similar" className="scroll-mt-24 border-t border-border-subtle py-14 md:py-20">
            <div className="mx-auto max-w-7xl px-5 md:px-10">
              <p className="kicker">You might also like</p>
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

      {/* The enquiry lives in a sheet over the page, opened by the buttons under the photos and the phone bar:
          after the description comes "Similar vehicles", not a form. */}
      {!sold && (
        <EnquirySheet title={`Interested in the ${v.model}?`}>
          <p className="text-text-secondary">
            Pick how we reach you. Each way gives you a reference number.
            {offsite && " The Sabicars team arranges the viewing and an inspection on request."}
          </p>
          <ReplyPromise className="mt-4" />
          <div className="mt-6">
            <EnquiryForm
              vehicleId={v.id}
              vehicleTitle={title}
              landingPath={`/vehicles/${v.slug}`}
              whatsappBase={whatsappLink()}
              taken={taken}
              offsite={offsite}
              frame="plain"
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
          <p className="figures mt-6 text-sm text-text-muted">
            Or call{" "}
            <a href={`tel:${site.phones[0].e164}`} className="text-text-primary">
              {site.phones[0].display}
            </a>
          </p>
        </EnquirySheet>
      )}

      {/* Phones: the price and the next step within thumb reach — above the tab bar, never under it — and out of
          the way while the page's own buttons are on screen or the sheet is open (StickyActions). */}
      {!sold && <StickyActions title={title} price={priceLabel(v)} phone={site.phones[0]} />}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript({ "@context": "https://schema.org", ...dealerJsonLd() }) }} />
    </article>
  );
}
