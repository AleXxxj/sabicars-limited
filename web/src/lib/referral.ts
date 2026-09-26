import { money, percentOf } from "@/lib/money";

/**
 * Refer & Earn, as Sabicars has confirmed it: 1.5% of the sale price, paid
 * only when the sale completes. Shared by the pages that explain it and the
 * code that will pay it, so the two can never disagree.
 */
export const REFERRAL_COMMISSION_BPS = 150;

export function commissionMinor(priceMinor: number): number {
  return percentOf(money(priceMinor, "NGN"), REFERRAL_COMMISSION_BPS).minor;
}

/** The programme's rules, in the order a sceptical reader needs them. */
export const PARTNER_RULES = [
  ["Free to join", "You never pay Sabicars anything — not to register, not ever. Anyone asking you to pay to join is not Sabicars."],
  ["Paid on sales, not sign-ups", "You earn only when a buyer you sent completes a purchase. No sale, no commission — and no cost to you."],
  ["No recruiting", "You earn from buyers you bring, never from other partners you sign up. There are no levels and no uplines."],
  ["Your buyer is on record", "A buyer who arrives through your link is recorded against your code the moment they enquire. Nobody can claim them from you."],
] as const;

/** How partners expect to find buyers — tells Sabicars which channels work. */
export const PARTNER_REACH = [
  "Instagram, TikTok or WhatsApp status",
  "Friends and family",
  "My workplace or business network",
  "I work around cars (driver, mechanic, dealer)",
  "Somewhere else",
] as const;
