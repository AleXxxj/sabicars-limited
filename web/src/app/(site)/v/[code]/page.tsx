import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, CircleSlash, Wrench } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { CHECKS, RESULT_LABEL, SECTIONS, isFresh, maskVin, type ItemResult, type Result } from "@/lib/inspection/checklist";
import { shareImageUrl } from "@/lib/media";
import { reportByCode } from "@/lib/repositories/inspections";
import { pageAddress, site } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";

export const revalidate = 300;

type Props = { params: Promise<{ code: string }> };

const longDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const km = (n: number) => `${n.toLocaleString("en-NG")} km`;
/** Evidence photos are shown as taken: resized, never colour-corrected. */
const evidence = (url: string, w: number) => url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`);

const TITLE_LABEL: Record<string, string> = {
  clean: "Clean title",
  salvage: "Salvage title",
  rebuilt: "Rebuilt title",
  flood: "Flood title",
  other: "Other (see the notes)",
  no_record: "No record found",
};

const CHIP: Record<Result, string> = {
  pass: "border-success/40 text-success",
  attention: "border-warning/50 text-warning",
  fail: "border-danger/50 text-danger",
  na: "border-border-default text-text-muted",
};

const ICON: Record<Result, typeof Check> = { pass: Check, attention: Wrench, fail: AlertTriangle, na: CircleSlash };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const found = await reportByCode(code);
  if (!found) return { title: "Report not found", robots: { index: false, follow: false } };
  const title = `Inspection report SV-${found.report.code}: ${vehicleTitle(found.vehicle)}`;
  const description = `${found.tally.pass} of ${found.tally.total} checks good${found.tally.attention + found.tally.fail ? `, ${found.tally.attention + found.tally.fail} findings shown with photos` : ""}. Inspected ${found.report.inspectedAt ? longDate(found.report.inspectedAt) : ""} by Sabicars.`;
  return {
    title,
    description,
    // The car's page is what search should find; the report is for the buyer holding the link or the seal.
    robots: { index: false, follow: true },
    ...pageAddress(`/v/${found.report.code}`, {
      title,
      description,
      images: found.vehicle.coverUrl ? [{ url: shareImageUrl(found.vehicle.coverUrl), width: 1200, height: 630, alt: vehicleTitle(found.vehicle) }] : undefined,
    }),
  };
}

function Finding({ label, item }: { label: string; item: ItemResult }) {
  const Icon = ICON[item.result];
  return (
    <li className="grid gap-4 border-t border-border-subtle py-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${item.result === "fail" ? "text-danger" : "text-warning"}`}>
          <Icon aria-hidden size={16} /> {RESULT_LABEL[item.result]}
        </p>
        <p className="mt-1 font-medium text-text-primary">{label}</p>
        {item.note && <p className="mt-2 leading-relaxed text-text-secondary">{item.note}</p>}
      </div>
      {item.photo && (
        <a href={item.photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border-default">
          {/* eslint-disable-next-line @next/next/no-img-element -- evidence photo, shown as taken */}
          <img src={evidence(item.photo.url, 560)} alt={`Photo: ${label}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </a>
      )}
    </li>
  );
}

/**
 * A Sabicars Verified report, as a buyer reads it: what was found first, then
 * the car's identity and history, then every check. Opened from the seal on
 * the windscreen, the car's page, or a shared link.
 */
export default async function ReportPage({ params }: Props) {
  const { code } = await params;
  const found = await reportByCode(code);
  if (!found) notFound();
  const { report: r, tally: t, vehicle: v, replacedBy } = found;
  const inspectedAt = r.inspectedAt!;
  const fresh = isFresh(inspectedAt);
  const findings = CHECKS.filter((c) => r.items[c.key]?.result === "attention" || r.items[c.key]?.result === "fail")
    // Faults before things that need attention.
    .sort((a, b) => (r.items[a.key].result === "fail" ? 0 : 1) - (r.items[b.key].result === "fail" ? 0 : 1));
  const hasPage = v.status === "available" || v.status === "reserved" || v.status === "sold";
  const rolledBack = r.historyLastOdometerKm !== null && r.odometerKm !== null && r.historyLastOdometerKm > r.odometerKm;
  const segments: [Result, number][] = [
    ["pass", t.pass],
    ["attention", t.attention],
    ["fail", t.fail],
    ["na", t.na],
  ];

  return (
    <>
      <section className="border-b border-border-subtle">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 pb-12 pt-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-10 md:pb-16 md:pt-20">
          <div className="min-w-0">
            {/* A car since moved away from the showroom keeps its report readable, but not as Verified. */}
            <p className="kicker">{v.heldOffsite ? `Inspection report SV-${r.code}` : `Sabicars Verified · report SV-${r.code}`}</p>
            <h1 className="mt-5 text-display-2">{vehicleTitle(v)}</h1>
            <dl className="figures mt-6 flex flex-wrap gap-x-8 gap-y-3 text-text-secondary">
              <div>
                <dt className="text-xs text-text-muted">Inspected</dt>
                <dd className="text-text-primary">{longDate(inspectedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">By</dt>
                <dd className="text-text-primary">{r.inspectorName}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Odometer</dt>
                <dd className="text-text-primary">{r.odometerKm !== null ? km(r.odometerKm) : "Not recorded"}</dd>
              </div>
            </dl>
          </div>
          {!v.heldOffsite && (
            // eslint-disable-next-line @next/next/no-img-element -- the vector seal
            <img src="/brand/seal.svg" alt="The Sabicars Verified seal" width={120} height={120} className="size-28 md:size-30" />
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-14 px-5 py-12 md:px-10 md:py-16">
        {(r.status === "superseded" || !fresh || v.status === "sold" || v.heldOffsite) && (
          <div role="status" className="space-y-2 border-l-2 border-warning bg-surface-1 px-5 py-4 text-text-secondary">
            {v.heldOffsite && (
              <p>
                <strong className="text-text-primary">This car is now held away from the Sabicars showroom, so it does not carry the Sabicars Verified seal.</strong>{" "}
                The report below records what was found on the day; it is not a current claim about the car. Ask and the Sabicars team will inspect it
                for you.
              </p>
            )}
            {r.status === "superseded" && (
              <p>
                <strong className="text-text-primary">A newer inspection has replaced this report.</strong>{" "}
                {replacedBy && (
                  <Link href={`/v/${replacedBy}`} className="text-link underline underline-offset-2">
                    Read the latest report, SV-{replacedBy}
                  </Link>
                )}
              </p>
            )}
            {r.status === "published" && !fresh && (
              <p>
                <strong className="text-text-primary">This report is more than four months old.</strong> Tyres, brakes and batteries change.
                Ask for a fresh inspection before you buy.
              </p>
            )}
            {v.status === "sold" && <p>This car has been sold. The report stays here as part of its record.</p>}
          </div>
        )}

        <section aria-labelledby="result" className="surface-card p-6 md:p-8">
          <h2 id="result" className="text-[1.5rem] leading-tight">
            {t.pass} of {t.total} checks good
          </h2>
          <div aria-hidden className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-2">
            {segments
              .filter(([, n]) => n > 0)
              .map(([res, n]) => (
                <span
                  key={res}
                  style={{ width: `${t.total ? (n / t.total) * 100 : 0}%` }}
                  className={res === "pass" ? "bg-success" : res === "attention" ? "bg-warning" : res === "fail" ? "bg-danger" : "bg-border-strong"}
                />
              ))}
          </div>
          <ul className="figures mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
            {segments.map(([res, n]) => (
              <li key={res}>
                <span className="font-semibold text-text-primary">{n}</span> {RESULT_LABEL[res].toLowerCase()}
              </li>
            ))}
          </ul>
          {r.summary && <p className="mt-6 max-w-3xl text-lg leading-relaxed text-text-secondary">{r.summary}</p>}
        </section>

        <section aria-labelledby="found">
          <h2 id="found" className="text-display-3">
            {findings.length ? "What was found" : "Nothing needed attention"}
          </h2>
          {findings.length ? (
            <ul className="mt-6">
              {findings.map((c) => (
                <Finding key={c.key} label={c.label} item={r.items[c.key]} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 max-w-2xl text-text-secondary">Every check that applies to this car was good on the day of the inspection.</p>
          )}
        </section>

        <section aria-labelledby="identity" className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 id="identity" className="eyebrow">
              Identity
            </h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm text-text-muted">Chassis number</dt>
                <dd className="figures text-lg text-text-primary">{r.vin ? maskVin(r.vin) : "Not recorded"}</dd>
              </div>
              {(["vin_matches_papers", "vin_matches_plates", "papers_customs"] as const).map((key) => {
                const it = r.items[key];
                const label = SECTIONS[0].checks.find((c) => c.key === key)?.label;
                return it ? (
                  <div key={key} className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${CHIP[it.result]}`}>{RESULT_LABEL[it.result]}</span>
                    <span className="text-text-secondary">{label}</span>
                  </div>
                ) : null;
              })}
            </dl>
            <p className="mt-4 text-sm text-text-muted">The last four characters are hidden in public. Check the full number on the car itself.</p>
          </div>
          <div>
            <h2 className="eyebrow">History</h2>
            {r.historySource ? (
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-sm text-text-muted">Source</dt>
                  <dd className="text-text-primary">
                    {r.historySource}
                    {r.historyCheckedAt ? `, checked ${longDate(r.historyCheckedAt)}` : ""}
                  </dd>
                </div>
                {r.historyTitle && (
                  <div>
                    <dt className="text-sm text-text-muted">Title</dt>
                    <dd className="text-text-primary">{TITLE_LABEL[r.historyTitle]}</dd>
                  </div>
                )}
                {r.historyAccidents !== null && (
                  <div>
                    <dt className="text-sm text-text-muted">Accidents on record</dt>
                    <dd className="figures text-text-primary">{r.historyAccidents}</dd>
                  </div>
                )}
                {r.historyLastOdometerKm !== null && (
                  <div>
                    <dt className="text-sm text-text-muted">Last odometer on record</dt>
                    <dd className="figures text-text-primary">{km(r.historyLastOdometerKm)}</dd>
                  </div>
                )}
                {rolledBack && (
                  <p className="border-l-2 border-danger pl-3 text-text-secondary">
                    <strong className="text-danger">The odometer reads lower today than the history records.</strong> That usually means it has
                    been wound back.
                  </p>
                )}
                {r.historyNotes && <p className="leading-relaxed text-text-secondary">{r.historyNotes}</p>}
                <p className="text-sm text-text-muted">The full history report can be seen at the showroom.</p>
              </dl>
            ) : (
              <p className="mt-4 text-text-secondary">No history report is on file for this car yet. Ask us, and we will look it up.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="every">
          <h2 id="every" className="text-display-3">
            Every check
          </h2>
          <div className="mt-6 space-y-3">
            {SECTIONS.map((s) => {
              const live = s.checks.filter((c) => !c.retired);
              return (
                <details key={s.key} className="surface-card group overflow-hidden">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold text-text-primary">{s.title}</span>
                    <span className="figures text-sm text-text-muted">
                      {live.filter((c) => r.items[c.key]?.result === "pass").length} of {live.filter((c) => r.items[c.key] && r.items[c.key].result !== "na").length} good
                    </span>
                  </summary>
                  <ul className="border-t border-border-subtle px-5">
                    {live.map((c) => {
                      const it = r.items[c.key];
                      return (
                        <li key={c.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border-subtle py-3 last:border-b-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-text-primary">{c.label}</p>
                            {it?.note && <p className="mt-1 text-sm text-text-secondary">{it.note}</p>}
                          </div>
                          {it && (
                            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHIP[it.result]}`}>{RESULT_LABEL[it.result]}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        </section>

        <section className="border-t border-border-subtle pt-10">
          <p className="max-w-3xl leading-relaxed text-text-secondary">
            This report records what {site.legalName}&rsquo;s inspector found on {longDate(inspectedAt)}. It is not a warranty. Cars change,
            so check it again before you pay, and bring your own mechanic if you like: every car can be inspected at the showroom before any
            money changes hands.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-text-muted">
            {v.heldOffsite
              ? "The seal is only given to cars the Sabicars team inspects at the Sabicars showroom; this car is now held elsewhere and does not carry it."
              : "Inspected by the Sabicars team at the Sabicars showroom. The seal is only given to cars inspected there."}
          </p>
          {hasPage && v.status !== "sold" && (
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/vehicles/${v.slug}`}>See the car</ButtonLink>
              <ButtonLink href={`/vehicles/${v.slug}#book-viewing`} variant="secondary">
                Book a viewing
              </ButtonLink>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
