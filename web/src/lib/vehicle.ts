import type { Vehicle } from "@/db/schema";
import { formatNaira, money, percentOf } from "@/lib/money";

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

const DRIVETRAIN_LABEL: Record<NonNullable<Vehicle["drivetrain"]>, string> = {
  fwd: "FWD",
  rwd: "RWD",
  awd: "AWD",
  "4wd": "4WD",
};

/** The 40% Drive Plan deposit, in basis points. */
export const DRIVE_PLAN_DEPOSIT_BPS = 4000;

/** A vehicle listed within this many days is a "new arrival". Derived, never stored, so it cannot go stale. */
const NEW_ARRIVAL_DAYS = 21;

export function vehicleTitle(v: Pick<Vehicle, "year" | "make" | "model">): string {
  return `${v.year} ${v.make} ${v.model}`;
}

export function priceLabel(v: Pick<Vehicle, "priceMinor">): string {
  return v.priceMinor ? formatNaira(v.priceMinor) : "Price on request";
}

/** What a buyer pays today on the 40% Drive Plan, or null when there is no price to take 40% of. */
export function drivePlanDeposit(v: Pick<Vehicle, "priceMinor">): string | null {
  if (!v.priceMinor) return null;
  return formatNaira(percentOf(money(v.priceMinor, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor);
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
 * The 60% Autochek finances after the 40% deposit. Autochek sets the tenor and
 * rate when it assesses the buyer, so neither is invented here.
 */
export function drivePlanBalance(v: Pick<Vehicle, "priceMinor">): string | null {
  if (!v.priceMinor) return null;
  const price = money(v.priceMinor, "NGN");
  return formatNaira(price.minor - percentOf(price, DRIVE_PLAN_DEPOSIT_BPS).minor);
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
