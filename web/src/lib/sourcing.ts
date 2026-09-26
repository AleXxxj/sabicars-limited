/**
 * The Sourcing Desk's vocabulary, shared by the homepage (where a request
 * starts) and /find (where it is completed), so a value chosen on one is
 * understood by the other.
 */

/** Budgets in whole naira, as a buyer thinks of them. An empty value means "not sure yet". */
export const BUDGET_OPTIONS = [
  { value: "10000000", label: "Up to ₦10m" },
  { value: "15000000", label: "Up to ₦15m" },
  { value: "20000000", label: "Up to ₦20m" },
  { value: "30000000", label: "Up to ₦30m" },
  { value: "50000000", label: "Up to ₦50m" },
  { value: "80000000", label: "Up to ₦80m" },
  { value: "150000000", label: "Up to ₦150m" },
  { value: "above", label: "Above ₦150m" },
] as const;

export function budgetLabel(value: string | undefined): string | null {
  return BUDGET_OPTIONS.find((b) => b.value === value)?.label ?? null;
}

/** The ceiling in kobo, or null when there is none (above the top band, or not stated). */
export function budgetMaxMinor(value: string | undefined): number | null {
  const naira = Number(value);
  return BUDGET_OPTIONS.some((b) => b.value === value) && Number.isInteger(naira) && naira > 0 ? naira * 100 : null;
}

export const YEAR_OPTIONS = [2024, 2022, 2020, 2018, 2016, 2014, 2012, 2010] as const;

export const PAYMENT_OPTIONS = [
  { value: "drive_plan", label: "40% Drive Plan" },
  { value: "cash", label: "Full payment" },
  { value: "undecided", label: "Not sure yet" },
] as const;
