import type { Vehicle } from "@/db/schema";
import { DEFAULT_ESTIMATE_MONTHS, depositMinorFor, depositPercentLabel, monthlyAtCeilingMinor } from "@/lib/drive-plan";
import { formatNaira } from "@/lib/money";

/** The words a Nigerian buyer uses, not the database's. */
export const CONDITION_LABEL: Record<Vehicle["condition"], string> = {
  foreign_used: "Foreign used",
  nigerian_used: "Nigerian used",
  brand_new: "Brand new",
};

export const BODY_LABEL: Record<NonNullable<Vehicle["body"]>, string> = {
  sedan: "Sedan",
  suv: "SUV",
  bus: "Bus",
  van: "Van",
  pickup: "Pickup",
  truck: "Truck",
  coupe: "Coupe",
  hatchback: "Hatchback",
  wagon: "Wagon",
  convertible: "Convertible",
  other: "Other",
};

export const DRIVETRAIN_LABEL: Record<NonNullable<Vehicle["drivetrain"]>, string> = {
  fwd: "FWD",
  rwd: "RWD",
  awd: "AWD",
  "4wd": "4WD",
};

/** A vehicle listed within this many days is a "new arrival". Derived, never stored, so it cannot go stale. */
const NEW_ARRIVAL_DAYS = 21;

export function vehicleTitle(v: Pick<Vehicle, "year" | "make" | "model">): string {
  return `${v.year} ${v.make} ${v.model}`;
}

export function priceLabel(v: Pick<Vehicle, "priceMinor">): string {
  return v.priceMinor ? formatNaira(v.priceMinor) : "Price on request";
}

/**
 * What a buyer pays today on the Drive Plan: 40% of the price for a car from
 * 2010, 50% for 2008–2009. Null when there is no price, or when Autochek would
 * not finance a car this old (lib/drive-plan.ts).
 */
export function drivePlanDeposit(v: Pick<Vehicle, "priceMinor" | "year">): string | null {
  const minor = depositMinorFor(v.priceMinor, v.year);
  return minor === null ? null : formatNaira(minor);
}

/** "40% deposit" or "50% deposit", for the label beside the figure; null when the car cannot go on the plan. */
export function drivePlanDepositLabel(v: Pick<Vehicle, "year">): string | null {
  const pct = depositPercentLabel(v.year);
  return pct ? `${pct} deposit` : null;
}

/** "Foreign used · 84,000 km · Automatic · AWD" — only the facts that are actually recorded. */
export function specLine(
  v: Pick<Vehicle, "condition" | "mileageKm" | "transmission" | "drivetrain" | "fuel">,
): string {
  return [
    CONDITION_LABEL[v.condition],
    v.mileageKm ? `${v.mileageKm.toLocaleString("en-NG")} km` : null,
    v.transmission === "automatic" ? "Automatic" : v.transmission === "manual" ? "Manual" : null,
    v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The specification table: only facts that were actually recorded. A row
 * reading "—" tells a buyer the dealer does not know its own car.
 */
export function specRows(v: Vehicle): { label: string; value: string }[] {
  const rows: [string, string | number | null | undefined][] = [
    ["Year", v.year],
    ["Condition", CONDITION_LABEL[v.condition]],
    ["Body", v.body ? BODY_LABEL[v.body] : null],
    ["Mileage", v.mileageKm ? `${v.mileageKm.toLocaleString("en-NG")} km` : null],
    ["Engine", v.engine],
    ["Power", v.horsepower ? `${v.horsepower} hp` : null],
    ["Transmission", v.transmissionDetail ?? (v.transmission === "automatic" ? "Automatic" : v.transmission === "manual" ? "Manual" : null)],
    ["Drivetrain", v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : null],
    ["Fuel", v.fuel ? v.fuel.charAt(0).toUpperCase() + v.fuel.slice(1) : null],
    ["Seats", v.seats],
    ["Exterior", v.exteriorColour],
    ["Interior", v.interiorColour],
  ];
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => ({ label, value: String(value) }));
}

/**
 * What Autochek finances after the deposit: 60% for a car from 2010, 50% for
 * 2008–2009. Autochek's lender sets the tenure and rate when it assesses the
 * buyer, so neither is invented here.
 */
export function drivePlanBalance(v: Pick<Vehicle, "priceMinor" | "year">): string | null {
  const deposit = depositMinorFor(v.priceMinor, v.year);
  return deposit === null || !v.priceMinor ? null : formatNaira(v.priceMinor - deposit);
}

/**
 * "₦518,486" — the estimated monthly repayment on this car's financed balance
 * over `months`, at Autochek's published ceiling (lib/drive-plan.ts). Always
 * shown with ESTIMATE_NOTE or "est." beside it: it is a figure to plan
 * around, not the lender's quote. Null when the car cannot go on the plan.
 */
export function drivePlanMonthly(v: Pick<Vehicle, "priceMinor" | "year">, months: number = DEFAULT_ESTIMATE_MONTHS): string | null {
  const deposit = depositMinorFor(v.priceMinor, v.year);
  if (deposit === null || !v.priceMinor) return null;
  const monthly = monthlyAtCeilingMinor(v.priceMinor - deposit, months);
  return monthly === null ? null : formatNaira(monthly);
}

/**
 * The single label a card shows. Status outranks merchandising: a reserved car
 * must never be advertised as "In demand".
 */
export function badgeFor(
  v: Pick<Vehicle, "status" | "badge" | "createdAt">,
  now = new Date(),
): string | null {
  if (v.status === "reserved") return "Reserved";
  if (v.status === "sold") return "Sold";
  if (v.badge === "hot") return "In demand";
  if (v.badge === "premium") return "Premium";
  if (v.badge === "fleet_supply") return "Fleet supply";
  const ageDays = (now.getTime() - new Date(v.createdAt).getTime()) / 86_400_000;
  return ageDays <= NEW_ARRIVAL_DAYS ? "New arrival" : null;
}
