"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { bankNameFor } from "@/lib/banks";
import { partnerByToken, saveBankAccount } from "@/lib/ledger";
import { notifyAccountSaved } from "@/lib/ledger-notify";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";

/**
 * A partner registers the bank account they are paid into, from their own
 * page. There is no login: the private token in their link is the proof that
 * it is them, exactly as it is for the page itself.
 */

export interface BankAccountFormResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** What was typed, to put back after a failed attempt. */
  values?: Record<string, string>;
  /** The name the bank holds for the account, when Paystack could ask it. */
  accountName?: string | null;
  /** True when that name is the partner's: nothing more is needed before a payout. */
  verified?: boolean;
}

const schema = z.object({
  token: z.uuid("This link is not valid."),
  bankCode: z.string().trim().min(1, "Choose your bank").max(10, "Choose your bank"),
  accountNumber: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : v),
    z.string().regex(/^[0-9]{10}$/, "A Nigerian account number has ten digits"),
  ),
});

/*
 * Two limits on saves, because each attempt asks the bank for the account
 * holder's name and nobody needs to change their account more than a few
 * times an hour:
 *
 * - per connection, in the database (lib/rate-limit.ts, "account"): shared by
 *   every server instance, so a loop or a script is stopped wherever it lands;
 * - per partner, in memory: a light second check that one partner's link is
 *   not being worked from many addresses at once. Per server instance and
 *   gone on a cold start, so it slows that down rather than stopping it.
 *
 * The token itself is the real gate.
 */
const SAVES_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;
const recentSaves = new Map<string, number[]>();

function tooManySaves(token: string): boolean {
  const now = Date.now();
  if (recentSaves.size > 1_000) for (const [k, times] of recentSaves) if (!times.some((t) => now - t < WINDOW_MS)) recentSaves.delete(k);
  const times = (recentSaves.get(token) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= SAVES_PER_HOUR) {
    recentSaves.set(token, times);
    return true;
  }
  times.push(now);
  recentSaves.set(token, times);
  return false;
}

export async function saveBankAccountByToken(_prev: BankAccountFormResult | null, formData: FormData): Promise<BankAccountFormResult> {
  const values = { bankCode: String(formData.get("bankCode") ?? ""), accountNumber: String(formData.get("accountNumber") ?? "") };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
    if (fieldErrors.token) return { ok: false, error: "This link is not valid. Open your partner page again from the link Sabicars gave you." };
    return { ok: false, fieldErrors, values };
  }
  const { token, bankCode, accountNumber } = parsed.data;

  try {
    const statement = await partnerByToken(token);
    if (!statement) return { ok: false, error: "This link is not valid. Open your partner page again from the link Sabicars gave you." };
    if (statement.partner.status !== "active") {
      return { ok: false, error: "This partner account is suspended, so the bank account cannot be changed. Please call Sabicars." };
    }
    // Both counted only after the token has proved itself, so guesses use up no one's allowance.
    if (!(await withinLimit("account"))) return { ok: false, error: RATE_LIMITED_MESSAGE, values };
    if (tooManySaves(statement.partner.id)) {
      return { ok: false, error: "This account has been changed several times in the last hour. Please wait a while, then try again.", values };
    }

    const bankName = await bankNameFor(bankCode);
    if (!bankName) return { ok: false, fieldErrors: { bankCode: "Choose your bank from the list" }, values };

    const saved = await saveBankAccount(statement.partner.id, { bankCode, bankName, accountNumber });
    if (!saved.ok) return { ok: false, error: saved.error, values };

    const partnerId = statement.partner.id;
    after(async () => {
      try {
        await notifyAccountSaved(partnerId);
      } catch (e) {
        console.error("[partner-account] could not send the account-saved note", e);
      }
    });
    revalidatePath(`/partner/${token}`);
    return { ok: true, accountName: saved.accountName, verified: saved.verified };
  } catch (e) {
    // The message only: a database error can carry the query's parameters, and the account number is one of them.
    console.error("[partner-account] save failed:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "Your account could not be saved just now. Please try again in a moment, or call Sabicars.", values };
  }
}
