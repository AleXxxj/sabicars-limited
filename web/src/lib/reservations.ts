/**
 * Reserving a car with a deposit: the owner's policy, as code.
 *
 * Decided 2026-10-31: the least a buyer can put down is ₦500,000, and that
 * holds the car for one week. A deposit of 40% of the price or more holds it
 * for a month at most. A deposit can be refunded, less a charge of 18% of the
 * amount deposited (holding the money, tax and electronic charges). One
 * reservation per car: nobody can deposit on a car another buyer has
 * deposited on or reserved, online or in the showroom.
 *
 * Plain functions, read by the car page, the checkout, the admin and the
 * assistant, and proved by `npm run test:reservations`. Money is in kobo.
 */

/** ₦500,000, in kobo. */
export const MIN_DEPOSIT_MINOR = 500_000 * 100;
/** A deposit of this share of the price (or more) earns the long hold. */
export const LONG_HOLD_FRACTION = 0.4;
/** How long the least deposit holds a car. */
export const SHORT_HOLD_DAYS = 7;
/** How long a 40%-or-more deposit holds a car, at most. */
export const LONG_HOLD_DAYS = 30;
/** The charge on a refund: 18% of the amount deposited. */
export const REFUND_CHARGE_BPS = 1800;
/** An unpaid attempt keeps its place this long, so two buyers cannot both be mid-payment on one car. */
export const PENDING_MINUTES = 30;

export type ReservationStatus =
  /** Started, not paid: the buyer is on Paystack's page. */
  | "pending"
  /** Paid: the car is held until `holdsUntil`. */
  | "held"
  /** The hold passed without a sale: the car is back on offer, the deposit still with us. */
  | "expired"
  /** The buyer paid the rest: the car is sold to them. */
  | "completed"
  /** The deposit was returned, less the charge. */
  | "refunded"
  /** Never paid, or stopped by staff. */
  | "cancelled";

/** The statuses that keep the car off the market for everyone else. */
export const HOLDING_STATUSES: readonly ReservationStatus[] = ["pending", "held"];

/** Whole naira, in kobo: a deposit is never a fraction of a naira. */
const wholeNaira = (minor: number) => Math.ceil(minor / 100) * 100;

/** The least that may be put down on a car: ₦500,000, or the whole price when the car costs less. */
export function minimumDepositMinor(priceMinor: number | null): number {
  if (priceMinor !== null && priceMinor < MIN_DEPOSIT_MINOR) return priceMinor;
  return MIN_DEPOSIT_MINOR;
}

/** The deposit that earns the month's hold: 40% of the price, rounded up to a naira. */
export function longHoldDepositMinor(priceMinor: number): number {
  return wholeNaira(priceMinor * LONG_HOLD_FRACTION);
}

/**
 * How many days a deposit holds the car, or null when the amount is not an
 * allowed deposit (below the minimum, above the price, or not whole naira).
 */
export function holdDaysFor(depositMinor: number, priceMinor: number | null): number | null {
  if (!Number.isInteger(depositMinor) || depositMinor % 100 !== 0) return null;
  if (depositMinor < minimumDepositMinor(priceMinor)) return null;
  if (priceMinor !== null && depositMinor > priceMinor) return null;
  if (priceMinor !== null && depositMinor >= longHoldDepositMinor(priceMinor)) return LONG_HOLD_DAYS;
  return SHORT_HOLD_DAYS;
}

/** When a hold that starts at `paidAt` ends. */
export function holdsUntil(paidAt: Date, days: number): Date {
  return new Date(paidAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/** What comes back on a refund: the deposit less 18%, rounded down to a naira. The charge is the rest. */
export function refundFor(depositMinor: number): { refundMinor: number; chargeMinor: number } {
  const refundMinor = Math.floor((depositMinor * (10_000 - REFUND_CHARGE_BPS)) / 10_000 / 100) * 100;
  return { refundMinor, chargeMinor: depositMinor - refundMinor };
}

export interface DepositChoice {
  /** Kobo. */
  amountMinor: number;
  /** "Least deposit", "40% of the price", "The full price". */
  label: string;
  holdDays: number;
}

/**
 * The amounts the checkout offers for a car: the least deposit (a week), 40%
 * (a month), and the full price (a month, and the car is yours). Fewer when
 * they coincide — a cheap car's 40% can be under ₦500,000.
 */
export function depositChoices(priceMinor: number): DepositChoice[] {
  const least = minimumDepositMinor(priceMinor);
  const long = longHoldDepositMinor(priceMinor);
  const choices: DepositChoice[] = [];
  const add = (amountMinor: number, label: string) => {
    const holdDays = holdDaysFor(amountMinor, priceMinor);
    if (holdDays !== null && !choices.some((c) => c.amountMinor === amountMinor)) choices.push({ amountMinor, label, holdDays });
  };
  add(least, "Least deposit");
  if (long > least && long < priceMinor) add(long, "40% of the price");
  add(priceMinor, "The full price");
  return choices;
}

/**
 * Whether a reservation row still keeps the car for its buyer at `now`: a
 * paid hold until it ends, or an unpaid attempt for a short while.
 */
export function stillHolding(r: { status: ReservationStatus; holdsUntil: Date | null; createdAt: Date }, now = new Date()): boolean {
  if (r.status === "held") return Boolean(r.holdsUntil && r.holdsUntil > now);
  if (r.status === "pending") return now.getTime() - r.createdAt.getTime() < PENDING_MINUTES * 60_000;
  return false;
}

/** Plain words for the hold a deposit buys. */
export function holdLabel(days: number): string {
  return days >= LONG_HOLD_DAYS ? "one month" : "one week";
}
