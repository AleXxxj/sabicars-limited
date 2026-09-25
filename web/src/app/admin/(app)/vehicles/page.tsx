import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { VehicleImage } from "@/components/VehicleImage";
import { requireStaff } from "@/lib/auth";
import { ADMIN_STATUSES, adminVehicleList, type AdminStatus } from "@/lib/repositories/admin-vehicles";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { priceLabel } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Inventory · Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ status?: string; q?: string; attention?: string }> };

const STATUS_LABEL: Record<AdminStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  draft: "Draft",
  sold: "Sold",
  unlisted: "Unlisted",
};

/** A status reads the same everywhere: gold is live, muted is not. */
const STATUS_TONE: Record<AdminStatus, string> = {
  available: "border-gold-500 text-accent-text",
  reserved: "border-info text-info",
  draft: "border-border-strong text-text-secondary",
  sold: "border-success text-success",
  unlisted: "border-border-default text-text-muted",
};

function href(p: { status?: string; q?: string; attention?: boolean }) {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.q) s.set("q", p.q);
  if (p.attention) s.set("attention", "1");
  const qs = s.toString();
  return qs ? `/admin/vehicles?${qs}` : "/admin/vehicles";
}

function ago(d: Date): string {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days < 30 ? `${days}d ago` : new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default async function AdminInventory({ searchParams }: Props) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = ADMIN_STATUSES.includes(sp.status as AdminStatus) ? (sp.status as AdminStatus) : undefined;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const attentionOnly = sp.attention === "1";
  const { rows, counts } = await adminVehicleList(me.dealerId, { status, q, attentionOnly });

  const tab = (value: AdminStatus | undefined, label: string, n: number) => {
    const active = status === value;
    return (
      <Link
        key={label}
        href={href({ status: value, q, attention: attentionOnly })}
        aria-current={active ? "true" : undefined}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors ${
          active ? "border-gold-500 text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
        }`}
      >
        {label} <span className="figures text-xs text-text-muted">{n}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 className="mt-2 text-display-3">Vehicles</h1>
        </div>
        <ButtonLink href="/admin/vehicles/new">Add a vehicle</ButtonLink>
      </div>

      <nav aria-label="Status" className="mt-8 flex gap-6 overflow-x-auto border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab(undefined, "All", counts.all)}
        {ADMIN_STATUSES.map((s) => tab(s, STATUS_LABEL[s], counts[s]))}
      </nav>

      <form action="/admin/vehicles" className="mt-6 flex flex-wrap items-center gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search make, model or year"
            className="min-h-12 w-full border border-border-default bg-surface-1 px-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold-500"
          />
        </label>
        <label className="inline-flex min-h-12 items-center gap-3 text-sm text-text-secondary">
          <input type="checkbox" name="attention" value="1" defaultChecked={attentionOnly} className="size-4 accent-[var(--gold-500)]" />
          Needs attention only
        </label>
        <button type="submit" className="eyebrow min-h-12 border border-border-default px-5 hover:border-border-strong">
          Search
        </button>
      </form>

      <p className="figures mt-6 text-sm text-text-muted">
        {rows.length} {rows.length === 1 ? "vehicle" : "vehicles"}
        {attentionOnly && " needing attention"}
      </p>

      <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
        {rows.map(({ vehicle: v, coverUrl, photoCount, attention }) => {
          const fixes = attention.filter((a) => a.level === "fix");
          return (
            <li key={v.id}>
              <Link href={`/admin/vehicles/${v.id}`} className="group flex items-center gap-4 py-4 transition-colors hover:bg-surface-1 md:px-3">
                <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden bg-surface-2 md:w-28">
                  <VehicleImage src={coverUrl ?? VEHICLE_PLACEHOLDER} alt="" fill sizes="112px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-primary">
                    {v.year} {v.make} {v.model}
                  </p>
                  <p className="figures mt-1 text-sm text-text-secondary">{priceLabel(v)}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span className={`border px-2 py-0.5 ${STATUS_TONE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                    <span className="figures">{photoCount} photos</span>
                    {v.isFeatured && <span>Featured</span>}
                    {v.inHero && <span>Homepage</span>}
                    <span>Updated {ago(v.updatedAt)}</span>
                  </p>
                </div>
                {fixes.length > 0 && (
                  <span title={fixes.map((f) => f.message).join("\n")} className="figures shrink-0 bg-surface-2 px-2.5 py-1 text-xs text-warning">
                    {fixes.length} to fix
                  </span>
                )}
                <span aria-hidden className="hidden shrink-0 text-text-muted transition-transform group-hover:translate-x-1 md:block">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && <p className="py-16 text-center text-text-muted">No vehicles match.</p>}
    </>
  );
}
