import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributeSale } from "@/components/admin/AttributeSale";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { can, requireStaff } from "@/lib/auth";
import { formOptions, vehicleForEdit } from "@/lib/repositories/admin-vehicles";
import { isFresh } from "@/lib/inspection/checklist";
import { commissionForVehicle } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";
import { reportsForVehicle } from "@/lib/repositories/inspections";
import { attentionFor } from "@/lib/vehicle-quality";
import { priceLabel, vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Edit vehicle · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

const ACTION_LABEL: Record<string, string> = {
  create: "Created",
  update: "Edited",
  status_change: "Status changed",
  photo_added: "Photo added",
  photo_removed: "Photo removed",
  photos_reordered: "Photos reordered",
  import: "Imported from the old site",
  inspection_started: "Inspection started",
  inspection_published: "Inspection report published",
  inspection_withdrawn: "Inspection report withdrawn",
  inspection_discarded: "Inspection draft discarded",
};

const whenLagos = (d: Date) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const dateLagos = (d: Date) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

export default async function EditVehicle({ params, searchParams }: Props) {
  const me = await requireStaff();
  const { id } = await params;
  // A malformed id is simply "not found", not a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await vehicleForEdit(me.dealerId, id);
  if (!found) notFound();
  const { vehicle: v, media, history } = found;
  const [options, { created }] = await Promise.all([formOptions(me.dealerId), searchParams]);
  const attention = attentionFor(v, media.length);
  const [reports, commission] = await Promise.all([reportsForVehicle(me.dealerId, v.id), v.status === "sold" ? commissionForVehicle(me.dealerId, v.id) : null]);
  const paysPartners = can.payPartners(me);
  const live = reports.find((r) => r.report.status === "published")?.report;
  const draft = reports.find((r) => r.report.status === "draft")?.report;
  const isPublic = v.status === "available" || v.status === "reserved" || v.status === "sold";

  return (
    <>
      <Link href="/admin/vehicles" className="text-sm text-text-muted hover:text-text-primary">
        ← Inventory
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{v.status === "draft" ? "Draft — not on the website" : v.status}</p>
          <h1 className="mt-2 text-display-3">{vehicleTitle(v)}</h1>
          <p className="figures mt-2 text-text-secondary">{priceLabel(v)}</p>
        </div>
        {isPublic && (
          <Link href={`/vehicles/${v.slug}`} target="_blank" className="eyebrow !text-text-secondary hover:!text-text-primary">
            View on the website ↗
          </Link>
        )}
      </div>

      {created && (
        <p role="status" className="mt-6 border-l-2 border-success bg-surface-1 px-4 py-3 text-sm text-text-secondary">
          Saved as {v.status === "draft" ? "a draft" : v.status}. Now add the photos.
        </p>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          <PhotoManager vehicleId={v.id} photos={media.filter((m) => m.kind === "photo").map((m) => ({ id: m.id, url: m.url, alt: m.alt }))} />
          <VehicleForm vehicle={v} options={options} canSetPrices={can.setPrices(me)} />
        </div>

        <aside className="space-y-10 lg:sticky lg:top-36 lg:self-start">
          {v.status === "sold" && (
            <section aria-label="Partner commission">
              <h2 className="eyebrow">Partner commission</h2>
              {commission ? (
                <>
                  <p className="mt-3 text-sm text-text-secondary">
                    {paysPartners ? (
                      <Link href={`/admin/partners/${commission.partnerId}`} className="text-text-primary hover:text-accent-text">
                        {commission.partnerName}
                      </Link>
                    ) : (
                      <span className="text-text-primary">{commission.partnerName}</span>
                    )}{" "}
                    <span className="figures text-text-muted">{commission.partnerCode}</span>
                    {commission.source === "manual" ? " — attributed by hand" : " — from the buyer’s own enquiry"}
                  </p>
                  <p className="figures mt-2 text-lg text-text-primary">{formatNaira(commission.amountMinor)}</p>
                  <p className="text-xs text-text-muted">1.5% of {formatNaira(commission.salePriceMinor)}</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {commission.status === "paid"
                      ? `Paid${commission.paidAt ? ` on ${dateLagos(commission.paidAt)}` : ""}.`
                      : commission.payable
                        ? "Ready to pay — the cooling-off has passed."
                        : `In its cooling-off until ${whenLagos(commission.payableAt)}.`}
                  </p>
                  {paysPartners && (
                    <Link href="/admin/payouts" className="mt-3 inline-block text-sm font-semibold text-accent-text hover:text-text-primary">
                      Payouts →
                    </Link>
                  )}
                </>
              ) : !v.soldPriceMinor ? (
                <p className="mt-3 text-sm text-text-secondary">Record what it sold for to create the partner’s commission.</p>
              ) : paysPartners ? (
                <>
                  <p className="mt-3 text-sm text-text-secondary">No partner is on record for this sale. Did a partner bring this buyer? Enter their code.</p>
                  <div className="mt-3">
                    <AttributeSale vehicleId={v.id} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-text-secondary">No partner is on record for this sale. A manager can attribute it to a partner’s code.</p>
              )}
            </section>
          )}

          <section>
            <h2 className="eyebrow">Sabicars Verified</h2>
            {v.heldOffsite ? (
              // The seal is only for cars inspected at the showroom. A car held
              // elsewhere is inspected on a buyer's request and never shows as Verified.
              <>
                <p className="mt-3 text-sm text-text-secondary">
                  {live
                    ? `Report SV-${live.code} is on record, but it is not shown as Verified while the car is held elsewhere.`
                    : draft
                      ? "An inspection is in progress, but it cannot be published: this car is not at the Sabicars showroom, so it cannot carry the Sabicars Verified seal."
                      : "Not at the Sabicars showroom: this car is inspected on a buyer’s request and does not carry the Sabicars Verified seal. Inspections are only started for showroom cars."}
                </p>
                {(live || draft) && (
                  <Link href={`/admin/vehicles/${v.id}/inspection`} className="mt-3 inline-block text-sm font-semibold text-accent-text hover:text-text-primary">
                    {draft ? "Continue the inspection →" : "Reports on record →"}
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-text-secondary">
                  {live
                    ? `Report SV-${live.code}, inspected ${live.inspectedAt?.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}${live.inspectedAt && !isFresh(live.inspectedAt) ? " — older than four months, so the badge is off" : ""}.`
                    : draft
                      ? "An inspection is in progress."
                      : "No inspection report yet. Without one, the car shows no Verified badge."}
                </p>
                <Link href={`/admin/vehicles/${v.id}/inspection`} className="mt-3 inline-block text-sm font-semibold text-accent-text hover:text-text-primary">
                  {draft ? "Continue the inspection →" : live ? "Reports and seal →" : "Start the inspection →"}
                </Link>
              </>
            )}
          </section>

          <section>
            <h2 className="eyebrow">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="mt-3 text-sm text-success">Nothing — this listing is complete.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {attention.map((a) => (
                  <li key={a.message} className={`border-l-2 pl-3 ${a.level === "fix" ? "border-warning text-text-primary" : "border-border-strong text-text-secondary"}`}>
                    {a.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="eyebrow">History</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {history.map((h, i) => (
                <li key={i} className="text-text-secondary">
                  <span className="text-text-primary">{ACTION_LABEL[h.action] ?? h.action}</span>
                  {h.action === "update" || h.action === "status_change" ? (
                    <span className="block text-xs text-text-muted">{Object.keys((h.diff as Record<string, unknown>) ?? {}).join(", ")}</span>
                  ) : null}
                  <span className="block text-xs text-text-muted">
                    {h.actorEmail ?? "System"} · {new Date(h.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
              {history.length === 0 && <li className="text-text-muted">Imported from the old site; no changes since.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
