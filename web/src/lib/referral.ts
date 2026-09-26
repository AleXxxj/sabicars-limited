import { money, percentOf } from "@/lib/money";

/**
 * Refer & Earn, as Sabicars has confirmed it: 1.5% of the sale price, paid
 * only when the sale completes. Shared by the pages that explain it and the
 * code that will pay it, so the two can never disagree.
 */
export const REFERRAL_COMMISSION_BPS = 150;

/** Confirmed by the owner (2026-09-26): the first partner to bring a buyer keeps them this long. */
export const ATTRIBUTION_DAYS = 90;

export function commissionMinor(priceMinor: number): number {
  return percentOf(money(priceMinor, "NGN"), REFERRAL_COMMISSION_BPS).minor;
}

/** The programme's rules, in the order a sceptical reader needs them. */
export const PARTNER_RULES = [
  ["Free to join", "You never pay Sabicars anything — not to register, not ever. Anyone asking you to pay to join is not Sabicars."],
  ["Paid on completed sales", "You earn only when a buyer you sent completes a purchase. Commission is paid once the sale is final, after a cooling-off of a day or two."],
  ["No recruiting", "You earn from buyers you bring, never from other partners you sign up. There are no levels and no uplines."],
  ["Your buyer is on record", `A buyer who comes through your link is recorded against your code from their first enquiry, and stays yours for ${ATTRIBUTION_DAYS} days.`],
] as const;

/** The practical terms, confirmed by the owner — shown on the programme page after the rules. */
export const PARTNER_TERMS = [
  ["Where your money goes", "Straight into the bank account you register, which must be in your own name. Your identity is confirmed before your first payout, so nobody else can collect what you earned."],
  ["Buying for yourself?", "Your own purchase doesn’t earn a commission — you get a partner price on it instead."],
  ["Fleet orders count in full", "Send a company or government buyer and your 1.5% is on the whole order."],
] as const;

/** How partners expect to find buyers — tells Sabicars which channels work. */
export const PARTNER_REACH = [
  "Instagram, TikTok or WhatsApp status",
  "Friends and family",
  "My workplace or business network",
  "I work around cars (driver, mechanic, dealer)",
  "Somewhere else",
] as const;
