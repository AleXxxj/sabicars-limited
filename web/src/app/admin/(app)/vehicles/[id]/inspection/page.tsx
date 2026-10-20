import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectionEditor } from "@/components/admin/InspectionEditor";
import { WithdrawReport } from "@/components/admin/WithdrawReport";
import { Button } from "@/components/ui/Button";
import { discardInspection, startInspection } from "@/lib/actions/inspections";
import { can, requireStaff } from "@/lib/auth";
import { isFresh, tally } from "@/lib/inspection/checklist";
import { vehicleForEdit } from "@/lib/repositories/admin-vehicles";
import { reportsForVehicle } from "@/lib/repositories/inspections";
import { vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Inspection · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

const STATUS_LABEL = { draft: "Draft", published: "Live", superseded: "Replaced by a newer report", withdrawn: "Withdrawn" } as const;

/** yyyy-mm-dd in Lagos, for a date input. */
const dayInLagos = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) : null);
const longDate = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/**
 * The Sabicars Verified report for one car: the draft being filled in, or the
 * reports on record and a way to start the next one.
 */
export default async function InspectionPage({ params }: Props) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await vehicleForEdit(me.dealerId, id);
  if (!found) notFound();
  const v = found.vehicle;
  const reports = await reportsForVehicle(me.dealerId, v.id);
  const draft = reports.find((r) => r.report.status === "draft")?.report;
  const canPublish = can.publishInspection(me);

  return (
    <>
      <Link href={`/admin/vehicles/${v.id}`} className="text-sm text-text-muted hover:text-text-primary">
        ← {vehicleTitle(v)}
      </Link>
      <div className="mt-6">
        <p className="eyebrow">Sabicars Verified</p>
        <h1 className="mt-2 text-display-3">Inspection report</h1>
        <p className="mt-2 max-w-2xl text-text-secondary">
          Answer every check. Anything that needs attention, or is a fault, needs a note and a photo before the report can be published.
          A published report is public at its own address and cannot be edited; start a new inspection to replace it.
        </p>
      </div>

      {draft ? (
        <div className="mt-10">
          <InspectionEditor
            canPublish={canPublish}
            report={{
              id: draft.id,
              code: draft.code,
              inspectedOn: dayInLagos(draft.inspectedAt),
              inspectorName: draft.inspectorName,
              odometerKm: draft.odometerKm,
              vin: draft.vin,
              summary: draft.summary,
              historySource: draft.historySource,
              historyCheckedOn: dayInLagos(draft.historyCheckedAt),
              historyTitle: draft.historyTitle,
              historyAccidents: draft.historyAccidents,
              historyLastOdometerKm: draft.historyLastOdometerKm,
              historyNotes: draft.historyNotes,
              items: draft.items,
            }}
          />
          <form action={discardInspection.bind(null, draft.id)} className="mt-2">
            <button type="submit" className="text-sm text-text-muted underline-offset-4 hover:text-danger hover:underline">
              Discard this draft
            </button>
          </form>
        </div>
      ) : (
        <form action={startInspection.bind(null, v.id)} className="mt-10">
          <Button type="submit">{reports.length ? "Start a new inspection" : "Start the inspection"}</Button>
        </form>
      )}

      {reports.some((r) => r.report.status !== "draft") && (
        <section className="mt-16">
          <h2 className="eyebrow">On record</h2>
          <ul className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
            {reports
              .filter((r) => r.report.status !== "draft")
              .map(({ report: r }) => {
                const t = tally(r.items);
                const fresh = r.inspectedAt ? isFresh(r.inspectedAt) : false;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <p className="figures font-medium text-text-primary">
                        SV-{r.code} · {STATUS_LABEL[r.status]}
                        {r.status === "published" && !fresh && <span className="ml-2 text-warning">Older than four months</span>}
                      </p>
                      <p className="figures text-sm text-text-muted">
                        {r.inspectedAt ? longDate(r.inspectedAt) : "No date"} · {r.inspectorName} · {t.pass} good, {t.attention} need{t.attention === 1 ? "s" : ""} attention, {t.fail} fault{t.fail === 1 ? "" : "s"}
                      </p>
                    </div>
                    {(r.status === "published" || r.status === "superseded") && (
                      <div className="flex flex-wrap items-center gap-5 text-sm">
                        <Link href={`/v/${r.code}`} target="_blank" className="text-accent-text hover:text-text-primary">
                          Public report ↗
                        </Link>
                        {r.status === "published" && (
                          <Link href={`/admin/seal/${r.id}`} target="_blank" className="text-accent-text hover:text-text-primary">
                            Print the seal ↗
                          </Link>
                        )}
                        {r.status === "published" && canPublish && <WithdrawReport reportId={r.id} />}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </>
  );
}
