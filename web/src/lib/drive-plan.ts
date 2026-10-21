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
  /** Months of bank statements Autochek asks for, from every applicant. */
  statementMonths: 6,
  /**
   * For a buyer without a commercial bank account: statements from the bank
   * app they actually use count, as long as they show money coming in and
   * going out. Autochek's team told Sabicars so on 20 October 2026.
   */
  statementAlternative: "a bank app such as OPay",
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

/** The repayment terms the site shows estimates for, all within Autochek's published range. */
export const ESTIMATE_MONTHS = [12, 24, 36, 48] as const;
export type EstimateMonths = (typeof ESTIMATE_MONTHS)[number];
/** The term an estimate is shown at before the buyer picks one: the longest Autochek publishes. */
export const DEFAULT_ESTIMATE_MONTHS: EstimateMonths = 48;

/**
 * The estimated monthly repayment on a financed balance: an ordinary amortised
 * loan at Autochek's published ceiling over `months`, rounded to whole naira.
 * The lender sets the real rate (it can be lower) and may add insurance, a
 * tracker and maintenance, so this is a figure to plan around, never a quote —
 * every place that shows it says so (ESTIMATE_NOTE). Null for nothing
 * financed or a term Autochek does not publish.
 */
export function monthlyAtCeilingMinor(balanceMinor: number | null | undefined, months: number): number | null {
  if (!balanceMinor || balanceMinor <= 0) return null;
  if (!Number.isInteger(months) || months < DRIVE_PLAN.tenureMonths.min || months > DRIVE_PLAN.tenureMonths.max) return null;
  const r = DRIVE_PLAN.maxAnnualRatePercent / 100 / 12;
  const monthly = Math.round((balanceMinor * r) / (1 - (1 + r) ** -months) / 100) * 100;
  // A balance of a few naira rounds to nothing: no figure rather than "₦0 a month".
  return monthly > 0 ? monthly : null;
}

/** The sentence under every estimate, so a monthly figure never travels without it. */
export const ESTIMATE_NOTE = `Estimated at Autochek’s published ceiling of ${DRIVE_PLAN.maxAnnualRatePercent}% a year. Your offer sets the real rate, which can be lower, and may add ${MONTHLY_INCLUDES}.`;

/** The short form, for a line under a grid of cards or a chat card where the full note will not fit. */
export const ESTIMATE_SHORT = `Monthly figures are estimates at Autochek’s published ${DRIVE_PLAN.maxAnnualRatePercent}% ceiling; the lender’s offer can be lower.`;

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
