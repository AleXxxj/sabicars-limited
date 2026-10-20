/**
 * The Drive Plan's terms, in one place.
 *
 * Autochek finances the balance, and its rules depend on the car's model year.
 * As Autochek's team told Sabicars on 20 October 2026: cars from 2010 need
 * 40% down, cars from 2008 and 2009 need 50% down, and older cars are not
 * financed at all. The year tiers are its lenders' rule — Autochek's own
 * listings show "40% minimum" on every car — so the site publishes the
 * stricter rule, attributed and dated. Every page, card, email and the
 * assistant reads these figures from here, so the site can never state two
 * different rules for the same car.
 *
 * Plain functions with no server imports: the finder and the price split run
 * them in the browser.
 */

export const DRIVE_PLAN = {
  /** Autochek does not finance cars older than this model year. */
  minYear: 2008,
  /** From this model year the standard deposit applies. */
  standardYear: 2010,
  /** The deposit for a car of standardYear or newer, in basis points. */
  standardDepositBps: 4000,
  /** The deposit for a car between minYear and standardYear, in basis points. */
  olderDepositBps: 5000,
  /** Months of bank statements Autochek asks for. */
  statementMonths: 6,
  /** Autochek's published ceiling, a year, in its app-store listing; the lender sets the actual rate. */
  maxAnnualRatePercent: 30,
  /** Repayment terms Autochek publishes. */
  tenureMonths: { min: 6, max: 48 } as const,
  /** The most a buyer may put down, in basis points: Autochek's listings say "40% minimum (max 70%)". */
  maxDepositBps: 7000,
  /**
   * What Autochek publishes in its app-store listing, quoted on the site as
   * Autochek's own example and never as a quote for any particular car.
   */
  published: {
    /** ₦1,000,000 over 12 months at the ceiling rate is about ₦97,487 a month (an ordinary amortised loan; verified on every build). */
    example: { principalMinor: 100_000_000, months: 12, monthlyMinor: 9_748_700 },
    /** The processing fee in that example, credited against the final payment if the loan goes through. */
    processingFeeMinor: 2_000_000,
    /** What the monthly repayment on a listing includes. */
    monthlyIncludes: ["comprehensive insurance", "a vehicle tracker", "a maintenance contract"],
    /** How soon Autochek says an offer follows a complete application. */
    offerWithin: "a few days",
  },
} as const;

/** "comprehensive insurance, a vehicle tracker and a maintenance contract" — what the listing's monthly figure includes. */
export const MONTHLY_INCLUDES = `${DRIVE_PLAN.published.monthlyIncludes.slice(0, -1).join(", ")} and ${DRIVE_PLAN.published.monthlyIncludes.at(-1)}`;

export type DrivePlanTerms = { eligible: true; depositBps: 4000 | 5000; depositPercent: 40 | 50; financedPercent: 60 | 50 } | { eligible: false };

/** What Autochek asks of a car of this model year. */
export function drivePlanTerms(year: number): DrivePlanTerms {
  if (!Number.isInteger(year) || year < DRIVE_PLAN.minYear) return { eligible: false };
  return year >= DRIVE_PLAN.standardYear
    ? { eligible: true, depositBps: 4000, depositPercent: 40, financedPercent: 60 }
    : { eligible: true, depositBps: 5000, depositPercent: 50, financedPercent: 50 };
}

/** The deposit basis points for a model year, or null when Autochek would not finance it. */
export function depositBpsFor(year: number): 4000 | 5000 | null {
  const t = drivePlanTerms(year);
  return t.eligible ? t.depositBps : null;
}

/** "40%" or "50%", or null when the car cannot go on the plan. */
export function depositPercentLabel(year: number): "40%" | "50%" | null {
  const t = drivePlanTerms(year);
  return t.eligible ? (`${t.depositPercent}%` as "40%" | "50%") : null;
}

/**
 * The deposit in kobo, rounded to a whole naira — nobody pays a deposit of
 * ₦500,000.50, and whole naira on both sides means the deposit and balance a
 * buyer is shown always add up to the price, even after formatting. Null when
 * there is no price or the car is too old.
 */
export function depositMinorFor(priceMinor: number | null | undefined, year: number): number | null {
  const bps = depositBpsFor(year);
  if (!priceMinor || bps === null) return null;
  return Math.round((priceMinor * bps) / 1_000_000) * 100;
}

/**
 * The highest price a deposit reaches on the standard tier: what "this much
 * down" can drive home for a car of standardYear or newer.
 */
export function reachMinorFor(depositMinor: number): number {
  return Math.floor((depositMinor * 10_000) / DRIVE_PLAN.standardDepositBps);
}

/** One sentence of the rule, for pages and the assistant. */
export const DRIVE_PLAN_RULE = `Cars from ${DRIVE_PLAN.standardYear} need 40% down; cars from ${DRIVE_PLAN.minYear} and ${DRIVE_PLAN.standardYear - 1} need 50% down; Autochek does not finance cars older than ${DRIVE_PLAN.minYear}.`;
