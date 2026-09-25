import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { consignors, vehicles } from "@/db/schema";
import { ConsignorForm } from "@/components/admin/ConsignorForm";
import { can, requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Consignors · Admin", robots: { index: false, follow: false } };

/**
 * People whose vehicles Sabicars sells on their behalf — the truck importer in
 * Japan first. Recorded so every consigned vehicle names its real owner, and so
 * each owner's stock and sales can be reported to them.
 */
export default async function Consignors() {
  const me = await requireStaff();
  if (!can.seeMoney(me)) redirect("/admin/vehicles");

  const rows = await db
    .select({ id: consignors.id, name: consignors.name, phone: consignors.phone, country: consignors.country, commissionBps: consignors.commissionBps, vehicles: count(vehicles.id) })
    .from(consignors)
    .leftJoin(vehicles, eq(vehicles.consignorId, consignors.id))
    .where(eq(consignors.dealerId, me.dealerId))
    .groupBy(consignors.id)
    .orderBy(asc(consignors.name));

  return (
    <>
      <p className="eyebrow">Consignment</p>
      <h1 className="mt-2 text-display-3">Consignors</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        Owners whose vehicles Sabicars sells on their behalf. Choose one under “Owned by” when listing their vehicle.
      </p>

      {rows.length > 0 ? (
        <ul className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-text-muted">{[c.country, c.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
              </div>
              <p className="figures text-sm text-text-secondary">
                {c.vehicles} {c.vehicles === 1 ? "vehicle" : "vehicles"}
                {c.commissionBps !== null && ` · ${(c.commissionBps / 100).toFixed(c.commissionBps % 100 ? 1 : 0)}% commission`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-muted">No consignors yet.</p>
      )}

      <section className="mt-12 max-w-3xl border-t border-border-subtle pt-8">
        <h2 className="eyebrow">Add a consignor</h2>
        <div className="mt-6">
          <ConsignorForm />
        </div>
      </section>
    </>
  );
}
