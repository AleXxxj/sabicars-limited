"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Check, PhoneCall } from "lucide-react";
import { fieldClass } from "@/components/forms/field";
import { VehicleImage } from "@/components/VehicleImage";
import { requestCallback } from "@/lib/actions/assistant";
import type { AssistantCar } from "@/lib/assistant/parts";
import { formatNaira } from "@/lib/money";

/* ── Cars ──────────────────────────────────────────────────────────────── */

function specs(c: AssistantCar): string {
  return [c.condition, c.mileageKm ? `${c.mileageKm.toLocaleString("en-NG")} km` : null, c.transmission].filter(Boolean).join(" · ");
}

function CarCard({ car, wide }: { car: AssistantCar; wide: boolean }) {
  return (
    <Link
      href={`/vehicles/${car.slug}`}
      className={`group block shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2/60 transition-colors hover:border-gold-500/40 ${wide ? "w-full" : "w-[15.5rem]"}`}
    >
      <span className="relative block aspect-[16/10] bg-surface-3">
        {car.coverUrl && (
          <VehicleImage src={car.coverUrl} alt={car.title} fill sizes="(max-width: 640px) 80vw, 250px" className="object-cover" />
        )}
        {car.reserved && (
          <span className="absolute top-2 left-2 rounded-full bg-surface-0/85 px-2.5 py-1 text-[0.7rem] font-semibold text-gold-200">
            Reserved
          </span>
        )}
        {car.wasPriceMinor && !car.reserved && (
          <span className="absolute top-2 left-2 rounded-full bg-surface-0/85 px-2.5 py-1 text-[0.7rem] font-semibold text-gold-200">
            Price reduced
          </span>
        )}
      </span>
      <span className="block p-3.5">
        <span className="block truncate font-semibold text-text-primary">{car.title}</span>
        <span className="figures mt-1 block text-[0.95rem] font-semibold text-gold-300">
          {car.priceMinor ? formatNaira(car.priceMinor) : "Price on request"}
        </span>
        {car.depositMinor && (
          <span className="figures block text-xs text-text-muted">{formatNaira(car.depositMinor)} down on the Drive Plan</span>
        )}
        <span className="mt-2 block truncate text-xs text-text-secondary">{specs(car)}</span>
      </span>
    </Link>
  );
}

export function CarCards({ cars }: { cars: AssistantCar[] }) {
  if (cars.length === 1) return <CarCard car={cars[0]} wide />;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cars.map((c) => (
        <CarCard key={c.slug} car={c} wide={false} />
      ))}
    </div>
  );
}

/* ── Comparison ────────────────────────────────────────────────────────── */

type Row = { label: string; value: (c: AssistantCar) => string | null; best?: "low" | "high"; num?: (c: AssistantCar) => number | null };

const ROWS: Row[] = [
  { label: "Price", value: (c) => (c.priceMinor ? formatNaira(c.priceMinor) : null), best: "low", num: (c) => c.priceMinor },
  { label: "40% down", value: (c) => (c.depositMinor ? formatNaira(c.depositMinor) : null), best: "low", num: (c) => c.depositMinor },
  { label: "Year", value: (c) => String(c.year), best: "high", num: (c) => c.year },
  { label: "Condition", value: (c) => c.condition },
  {
    label: "Mileage",
    value: (c) => (c.mileageKm ? `${c.mileageKm.toLocaleString("en-NG")} km` : null),
    best: "low",
    num: (c) => c.mileageKm,
  },
  { label: "Engine", value: (c) => c.engine },
  { label: "Gearbox", value: (c) => c.transmission },
  { label: "Drive", value: (c) => c.drivetrain },
  { label: "Fuel", value: (c) => c.fuel },
  { label: "Seats", value: (c) => (c.seats ? String(c.seats) : null), best: "high", num: (c) => c.seats },
];

/** Which car wins a row, when the row has a winner and more than one car states it. */
export function winnerOf(row: Row, cars: AssistantCar[]): number | null {
  if (!row.best || !row.num) return null;
  const nums = cars.map(row.num);
  const stated = nums.filter((n): n is number => n !== null);
  if (stated.length < 2 || new Set(stated).size === 1) return null;
  const target = row.best === "low" ? Math.min(...stated) : Math.max(...stated);
  return nums.filter((n) => n === target).length === 1 ? nums.indexOf(target) : null;
}

export function CompareCard({ cars, href }: { cars: AssistantCar[]; href: string }) {
  // Two cars fit a phone; a third scrolls sideways rather than squeezing every column.
  const cols = `5.25rem repeat(${cars.length}, minmax(0, 1fr))`;
  const minWidth = `${5.25 + cars.length * 8.75}rem`;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2/50">
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <div style={{ minWidth }}>
          <div className="grid gap-x-3 border-b border-white/[0.06] p-3" style={{ gridTemplateColumns: cols }}>
            <span />
            {cars.map((c) => (
              <Link key={c.slug} href={`/vehicles/${c.slug}`} className="group block">
                <span className="relative block aspect-[16/10] overflow-hidden rounded-xl bg-surface-3">
                  {c.coverUrl && <VehicleImage src={c.coverUrl} alt={c.title} fill sizes="160px" className="object-cover" />}
                </span>
                <span className="mt-2 line-clamp-2 block text-[0.82rem] leading-snug font-semibold text-text-primary group-hover:text-gold-200">
                  {c.title}
                </span>
              </Link>
            ))}
          </div>
          <dl>
            {ROWS.map((row) => {
              if (cars.every((c) => !row.value(c))) return null;
              const win = winnerOf(row, cars);
              return (
                <div
                  key={row.label}
                  className="grid gap-x-3 border-b border-white/[0.04] px-3 py-2 last:border-0"
                  style={{ gridTemplateColumns: cols }}
                >
                  <dt className="text-xs text-text-muted">{row.label}</dt>
                  {cars.map((c, i) => {
                    const v = row.value(c);
                    return (
                      <dd
                        key={c.slug}
                        className={`figures text-[0.82rem] ${v ? (win === i ? "font-semibold text-gold-200" : "text-text-secondary") : "text-text-muted italic"}`}
                      >
                        {v ?? "Not stated"}
                      </dd>
                    );
                  })}
                </div>
              );
            })}
          </dl>
        </div>
      </div>
      <Link
        href={href}
        className="group flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-sm font-semibold text-gold-300 hover:bg-white/[0.03] hover:text-gold-200"
      >
        Open the full comparison <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

/* ── Call me back ──────────────────────────────────────────────────────── */

export function CallbackForm({ conversationId, path }: { conversationId: string | null; path: string }) {
  const [renderedAt] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  if (done)
    return (
      <div role="status" className="flex gap-3 rounded-2xl border border-gold-500/30 bg-gold-500/[0.07] p-4 text-sm text-text-secondary">
        <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-gold-300" />
        <p>
          Thank you, {done.name.split(" ")[0]}. Someone from the team will call you — during showroom hours if it’s late. Your reference is{" "}
          <span className="figures font-semibold text-text-primary">{done.reference}</span>.
        </p>
      </div>
    );

  return (
    <form
      className="grid gap-3 rounded-2xl border border-white/[0.08] bg-surface-2/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const website = String(new FormData(e.currentTarget).get("website") ?? "");
        setError(null);
        start(async () => {
          const r = await requestCallback({ conversationId, name, phone, path, website, renderedAt });
          if (r.ok && r.reference) setDone({ reference: r.reference, name });
          else setError(r.error ?? "Something went wrong — please call or WhatsApp us.");
        });
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <PhoneCall aria-hidden size={16} className="text-gold-300" /> Have someone call you
      </p>
      <label className="grid gap-1.5">
        <span className="sr-only">Your name</span>
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          required
          maxLength={80}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="sr-only">Your phone number</span>
        <input
          className={fieldClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={30}
        />
      </label>
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-5 font-semibold text-[#0A0908] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Call me back"}
      </button>
    </form>
  );
}
