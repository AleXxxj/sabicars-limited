import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { can, requireStaff } from "@/lib/auth";
import { formOptions, vehicleForEdit } from "@/lib/repositories/admin-vehicles";
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
};

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
