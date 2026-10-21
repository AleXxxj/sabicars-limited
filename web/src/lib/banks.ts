import "server-only";
import { listBanks, paystackConfigured } from "@/lib/paystack";

/**
 * The banks a partner can be paid into, for the bank account form.
 *
 * The codes are Paystack's NIP bank codes — the same ones its "resolve
 * account" and transfer calls take — so a choice made here can be verified
 * and paid without translation. The live Paystack list replaces the one
 * below as soon as PAYSTACK_SECRET_KEY is set; the built-in list stands in
 * until then, and whenever Paystack cannot be reached, so the form never
 * comes up empty.
 */
export interface BankOption {
  code: string;
  name: string;
}

const STATIC_BANKS: BankOption[] = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank" },
  { code: "050", name: "Ecobank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "00103", name: "Globus Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "303", name: "Lotus Bank" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
  { code: "104", name: "Parallex Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "302", name: "TAJ Bank" },
  { code: "102", name: "Titan Trust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
].sort((a, b) => a.name.localeCompare(b.name, "en"));

/** The banks to offer in the form: Paystack's list when it can be had, the built-in one otherwise. */
export async function banksForForm(): Promise<BankOption[]> {
  if (paystackConfigured()) {
    try {
      const live = await listBanks();
      if (live.length) return live;
    } catch (e) {
      console.error("[banks] could not load Paystack's bank list; using the built-in one", e instanceof Error ? e.message : e);
    }
  }
  return STATIC_BANKS;
}

/**
 * The name on record for a bank code — looked up here, never taken from the
 * form, so what is saved against a partner is always a bank we know. Falls
 * back to the built-in list for a code Paystack's list no longer carries.
 */
export async function bankNameFor(code: string): Promise<string | null> {
  const wanted = code.trim();
  if (!wanted) return null;
  const banks = await banksForForm();
  return banks.find((b) => b.code === wanted)?.name ?? STATIC_BANKS.find((b) => b.code === wanted)?.name ?? null;
}
