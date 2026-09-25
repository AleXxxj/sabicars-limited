"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { Vehicle } from "@/db/schema";
import { saveVehicle } from "@/lib/actions/vehicles";
import { Button } from "@/components/ui/Button";

type Option = { value: string; label: string };

const BODY: Option[] = [
  ["sedan", "Sedan"], ["suv", "SUV"], ["bus", "Bus"], ["van", "Van"], ["pickup", "Pickup"], ["truck", "Truck"],
  ["coupe", "Coupe"], ["hatchback", "Hatchback"], ["wagon", "Wagon"], ["convertible", "Convertible"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));
const SEGMENT: Option[] = [
  { value: "standard", label: "Standard" },
  { value: "luxury", label: "Luxury" },
  { value: "commercial", label: "Commercial (buses, trucks)" },
];
const CONDITION: Option[] = [
  { value: "foreign_used", label: "Foreign used (tokunbo)" },
  { value: "nigerian_used", label: "Nigerian used" },
  { value: "brand_new", label: "Brand new" },
];
const FUEL: Option[] = ["petrol", "diesel", "hybrid", "electric", "cng", "other"].map((v) => ({ value: v, label: v === "cng" ? "CNG" : v[0].toUpperCase() + v.slice(1) }));
const TRANSMISSION: Option[] = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];
const DRIVETRAIN: Option[] = ["fwd", "rwd", "awd", "4wd"].map((v) => ({ value: v, label: v.toUpperCase() }));
const STATUS: Option[] = [
  { value: "draft", label: "Draft — not on the website" },
  { value: "available", label: "Available — on the website" },
  { value: "reserved", label: "Reserved — deposit taken" },
  { value: "sold", label: "Sold" },
  { value: "unlisted", label: "Unlisted — withdrawn" },
];
const BADGE: Option[] = [
  { value: "hot", label: "In demand" },
  { value: "premium", label: "Premium" },
  { value: "fleet_supply", label: "Fleet supply" },
];

const input =
  "min-h-12 w-full border border-border-strong bg-surface-0 px-4 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold-500 disabled:opacity-60";

/** Kobo -> "38,000,000" for the price box. */
const nairaText = (kobo: number | null | undefined) => (kobo ? (kobo / 100).toLocaleString("en-NG") : "");

/**
 * Defined at module level on purpose. A component declared inside another is
 * a new component on every render, so React would rebuild these inputs — and
 * wipe what was typed — the moment the form re-rendered to say "Saving…".
 */
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid content-start gap-2">
      <span className="eyebrow !text-text-secondary">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

function Select({ name, options: opts, value, blankLabel, invalid }: { name: string; options: Option[]; value?: string | null; blankLabel?: string; invalid?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? ""} aria-invalid={invalid} className={input}>
      {blankLabel !== undefined && <option value="">{blankLabel}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export interface FormOptions {
  makes: string[];
  consignors: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}

export function VehicleForm({ vehicle: v, options, canSetPrices }: { vehicle?: Vehicle; options: FormOptions; canSetPrices: boolean }) {
  const [state, dispatch, pending] = useActionState(saveVehicle, null);
  // "Saved" shows for the latest save until its timer dismisses it. Derived from
  // the result rather than set in an effect, so it costs no extra render.
  const [dismissedAt, setDismissedAt] = useState<number | undefined>();
  const savedFlash = Boolean(state?.savedAt && state.savedAt !== dismissedAt);

  // Submitted by hand rather than through the form's action prop: React resets
  // a form after an action, which would wipe a salesperson's edits whenever a
  // single field needed correcting.
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  useEffect(() => {
    const at = state?.savedAt;
    if (!at) return;
    const t = setTimeout(() => setDismissedAt(at), 4000);
    return () => clearTimeout(t);
  }, [state?.savedAt]);

  const err = (name: string) => state?.fieldErrors?.[name];

  const section = "grid gap-6 border-t border-border-subtle pt-8 sm:grid-cols-2";
  const heading = "eyebrow sm:col-span-2";

  return (
    <form onSubmit={submit} className="grid gap-10 pb-28" noValidate>
      {v && <input type="hidden" name="id" value={v.id} />}

      <fieldset className={section}>
        <legend className={heading}>The vehicle</legend>
        <Field error={err("make")} label="Make">
          <input name="make" list="makes" required defaultValue={v?.make} placeholder="Toyota" className={input} />
          <datalist id="makes">
            {options.makes.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field error={err("model")} label="Model" hint="The model only — e.g. “Land Cruiser Prado”, not the whole description">
          <input name="model" required defaultValue={v?.model} className={input} />
        </Field>
        <Field error={err("year")} label="Year">
          <input name="year" inputMode="numeric" required defaultValue={v?.year} placeholder="2018" className={`figures ${input}`} />
        </Field>
        <Field error={err("trim")} label="Trim (optional)" hint="e.g. Limited, XLE, F Sport">
          <input name="trim" defaultValue={v?.trim ?? ""} className={input} />
        </Field>
        <Field error={err("body")} label="Body type">
          <Select invalid={Boolean(err("body"))} name="body" options={BODY} value={v?.body} blankLabel="Choose…" />
        </Field>
        <Field error={err("segment")} label="Segment">
          <Select invalid={Boolean(err("segment"))} name="segment" options={SEGMENT} value={v?.segment ?? "standard"} />
        </Field>
        <Field error={err("condition")} label="Condition">
          <Select invalid={Boolean(err("condition"))} name="condition" options={CONDITION} value={v?.condition ?? "foreign_used"} />
        </Field>
        <Field error={err("chassisNo")} label="Chassis number (optional)" hint="Kept private — never shown on the website">
          <input name="chassisNo" defaultValue={v?.chassisNo ?? ""} className={`figures ${input}`} />
        </Field>
      </fieldset>

      <fieldset className={section}>
        <legend className={heading}>Specification</legend>
        <Field error={err("mileageKm")} label="Mileage (km)">
          <input name="mileageKm" inputMode="numeric" defaultValue={v?.mileageKm?.toLocaleString("en-NG") ?? ""} placeholder="84,000" className={`figures ${input}`} />
        </Field>
        <Field error={err("fuel")} label="Fuel">
          <Select invalid={Boolean(err("fuel"))} name="fuel" options={FUEL} value={v?.fuel} blankLabel="Not recorded" />
        </Field>
        <Field error={err("transmission")} label="Gearbox">
          <Select invalid={Boolean(err("transmission"))} name="transmission" options={TRANSMISSION} value={v?.transmission} blankLabel="Not recorded" />
        </Field>
        <Field error={err("transmissionDetail")} label="Gearbox detail (optional)" hint="e.g. 9G-TRONIC 9-speed">
          <input name="transmissionDetail" defaultValue={v?.transmissionDetail ?? ""} className={input} />
        </Field>
        <Field error={err("drivetrain")} label="Drivetrain">
          <Select invalid={Boolean(err("drivetrain"))} name="drivetrain" options={DRIVETRAIN} value={v?.drivetrain} blankLabel="Not recorded" />
        </Field>
        <Field error={err("engine")} label="Engine (optional)" hint="e.g. 3.5L V6">
          <input name="engine" defaultValue={v?.engine ?? ""} className={input} />
        </Field>
        <Field error={err("horsepower")} label="Horsepower (optional)">
          <input name="horsepower" inputMode="numeric" defaultValue={v?.horsepower ?? ""} className={`figures ${input}`} />
        </Field>
        <Field error={err("seats")} label="Seats">
          <input name="seats" inputMode="numeric" defaultValue={v?.seats ?? ""} className={`figures ${input}`} />
        </Field>
        <Field error={err("exteriorColour")} label="Exterior colour">
          <input name="exteriorColour" defaultValue={v?.exteriorColour ?? ""} className={input} />
        </Field>
        <Field error={err("interiorColour")} label="Interior colour">
          <input name="interiorColour" defaultValue={v?.interiorColour ?? ""} className={input} />
        </Field>
      </fieldset>

      <fieldset className={section}>
        <legend className={heading}>Price and status</legend>
        <Field
          error={err("price")}
          label="Price (₦)"
          hint={canSetPrices ? "In full, e.g. 38,000,000. Leave empty for “price on request”." : "Only an owner or manager can change prices."}
        >
          <input name="price" inputMode="numeric" disabled={!canSetPrices} defaultValue={nairaText(v?.priceMinor)} placeholder="38,000,000" className={`figures ${input}`} />
        </Field>
        <Field error={err("wasPrice")} label="Previous price (optional)" hint="Only for a genuine reduction — shown struck through">
          <input name="wasPrice" inputMode="numeric" disabled={!canSetPrices} defaultValue={nairaText(v?.wasPriceMinor)} className={`figures ${input}`} />
        </Field>
        <Field error={err("status")} label="Status">
          <Select invalid={Boolean(err("status"))} name="status" options={STATUS} value={v?.status ?? "draft"} />
        </Field>
        <Field error={err("badge")} label="Label on the listing (optional)">
          <Select invalid={Boolean(err("badge"))} name="badge" options={BADGE} value={v?.badge} blankLabel="None" />
        </Field>
        <div className="grid gap-3 sm:col-span-2">
          <label className="inline-flex min-h-11 items-center gap-3 text-text-secondary">
            <input type="checkbox" name="isFeatured" defaultChecked={v?.isFeatured} className="size-4 accent-[var(--gold-500)]" />
            Feature on the homepage and at the top of the inventory
          </label>
          <label className="inline-flex min-h-11 items-center gap-3 text-text-secondary">
            <input type="checkbox" name="inHero" defaultChecked={v?.inHero} className="size-4 accent-[var(--gold-500)]" />
            Use in the homepage hero (needs a strong exterior cover photo)
          </label>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className={heading}>Ownership and location</legend>
        <Field error={err("consignorId")} label="Owned by" hint="Choose a consignor for a vehicle Sabicars sells on someone else’s behalf">
          <select name="consignorId" defaultValue={v?.consignorId ?? ""} className={input}>
            <option value="">Sabicars</option>
            {options.consignors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (consigned)
              </option>
            ))}
          </select>
        </Field>
        <Field error={err("locationId")} label="Where it is">
          <select name="locationId" defaultValue={v?.locationId ?? options.locations[0]?.id ?? ""} className={input}>
            {options.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-6 border-t border-border-subtle pt-8">
        <legend className="eyebrow">Description and features</legend>
        <Field error={err("description")} label="Description" hint="What a buyer would ask about: history, condition, papers, what makes this one right">
          <textarea name="description" rows={6} defaultValue={v?.description ?? ""} className={`${input} py-3 leading-relaxed`} />
        </Field>
        <Field error={err("features")} label="Features" hint="One per line — e.g. Sunroof, Reverse camera, Leather seats">
          <textarea name="features" rows={6} defaultValue={v?.features.join("\n") ?? ""} className={`${input} py-3 leading-relaxed`} />
        </Field>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-surface-0/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <p aria-live="polite" className="min-w-0 truncate text-sm">
            {state?.error ? (
              <span className="text-danger">{state.error}</span>
            ) : savedFlash ? (
              <span className="text-success">Saved — the website is up to date</span>
            ) : (
              <span className="text-text-muted">{v ? "Changes save to the live listing" : "Save first, then add photos"}</span>
            )}
          </p>
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? "Saving…" : v ? "Save changes" : "Save vehicle"}
          </Button>
        </div>
      </div>
    </form>
  );
}
