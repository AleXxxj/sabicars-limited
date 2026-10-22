/**
 * What the end-to-end suites seed and look for, in one place, so the seed
 * (scripts/seed-e2e.mts), the flows suite and the clean-up can never
 * disagree about a slug, a name or a phone number. Plain data: no imports,
 * so a script and a test can both load it.
 *
 * Every row the suites create is recognisable on sight — a slug starting
 * "e2e-", a partner or buyer whose name starts "E2E " — so a stray row in
 * a database is never mistaken for a customer, and `--clean` can find it.
 */

/** Kobo. */
const naira = (n: number) => n * 100;

export const E2E = {
  dealerSlug: "sabicars",

  /** A buyer who enquires about a car. Typed as a Lagos number; stored in E.164. */
  buyer: { name: "E2E Buyer", typedPhone: "0803 000 0001", phone: "+2348030000001" },

  /** A Refer & Earn partner. */
  partner: { name: "E2E Partner", typedPhone: "0803 000 0002", phone: "+2348030000002" },

  /** The bank account the partner registers: Guaranty Trust Bank, Paystack code 058. */
  bank: { name: "Guaranty Trust Bank", code: "058", accountNumber: "0123456789", masked: "••••••6789" },

  /** The bank's own reference for the transfer a manager records. */
  bankReference: "E2E-REF-1",

  /** Three cars, one at each Drive Plan tier: 40% down (from 2010), 50% down (2008–2009), cash only (older). */
  vehicles: {
    hummer: {
      slug: "e2e-2013-toyota-hiace-hummer-1",
      year: 2013,
      make: "Toyota",
      model: "Hiace Hummer",
      priceMinor: naira(24_000_000),
      body: "bus",
      segment: "commercial",
      seats: 18,
      fuel: "diesel",
    },
    camry: {
      slug: "e2e-2009-toyota-camry",
      year: 2009,
      make: "Toyota",
      model: "Camry",
      priceMinor: naira(20_000_000),
      body: "sedan",
      segment: "standard",
      seats: 5,
      fuel: "petrol",
    },
    hiace: {
      slug: "e2e-2006-toyota-hiace",
      year: 2006,
      make: "Toyota",
      model: "Hiace",
      priceMinor: naira(14_500_000),
      body: "bus",
      segment: "commercial",
      seats: 15,
      fuel: "petrol",
    },
  },

  /** What the 2013 Hummer sells for in the money path, and the 1.5% it earns the partner. */
  sale: { typedPrice: "24,000,000", priceMinor: naira(24_000_000), commissionMinor: naira(360_000), commissionLabel: "₦360,000" },
} as const;

export type E2EVehicle = (typeof E2E.vehicles)[keyof typeof E2E.vehicles];

/** Every seeded vehicle, in the order they are listed. */
export const E2E_VEHICLES: readonly E2EVehicle[] = Object.values(E2E.vehicles);

/** How a seeded row is recognised. */
export const E2E_SLUG_PREFIX = "e2e-";
export const E2E_NAME_PREFIX = "E2E ";
export const E2E_PHONES: readonly string[] = [E2E.buyer.phone, E2E.partner.phone];
