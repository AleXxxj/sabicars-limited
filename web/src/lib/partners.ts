import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { ATTRIBUTION_DAYS } from "@/lib/referral";

/**
 * Attribution for Refer & Earn. A partner's link (/r/CODE) leaves this cookie;
 * any lead saved while it is present is recorded against that partner.
 *
 * First touch wins for 90 days (confirmed by the owner): the partner who first
 * brought a buyer keeps them, so a second link cannot take the commission.
 */
export const PARTNER_COOKIE = "sc_partner";
export const PARTNER_COOKIE_MAX_AGE = ATTRIBUTION_DAYS * 24 * 60 * 60;

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** No 0/O or 1/I: a code is read aloud and copied by hand. 32 symbols, so a byte maps without bias. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSymbols(n: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Up to three letters of the partner's name, then random symbols: ADA7K3. Memorable, and still hard to guess. */
export function codeFor(name: string, attempt = 0): string {
  const letters = attempt < 3 ? name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) : "";
  return letters + randomSymbols(6 - letters.length);
}

export function isPartnerCode(value: string | undefined | null): value is string {
  return Boolean(value && CODE_PATTERN.test(value));
}

export async function activePartnerByCode(dealerId: string, code: string) {
  if (!isPartnerCode(code)) return null;
  const [row] = await db
    .select({ id: partners.id, phone: partners.phone, name: partners.name })
    .from(partners)
    .where(and(eq(partners.dealerId, dealerId), eq(partners.code, code), eq(partners.status, "active")))
    .limit(1);
  return row ?? null;
}

/**
 * Who sent this visitor, for the visitor to see: the partner's first name, readable by the page
 * (the code itself stays in the httpOnly PARTNER_COOKIE). Set by /r/CODE alongside it, for as long.
 */
export const REFERRER_NAME_COOKIE = "sc_ref";
/** Set on arrival through a partner's link, for the page to welcome the visitor once, then cleared. */
export const REFERRER_WELCOME_COOKIE = "sc_ref_new";

/** A partner's first name as a visitor reads it: one word of letters and digits ("Ada", "Tunde2"), never empty. */
export function firstNameForVisitor(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^\p{L}\p{N}'-]/gu, "").slice(0, 24);
  return clean ? clean[0].toUpperCase() + clean.slice(1) : "A partner";
}

export function referralLink(base: string, code: string): string {
  return `${base}/r/${code}`;
}
