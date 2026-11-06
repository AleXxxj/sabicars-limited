"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";
import { notifyPartnerWelcome, notifyPinLink } from "@/lib/ledger-notify";
import { hashPin, lockMinutesAfter, looksLikeSecret, pinProblem, triesLeft, verifyPin } from "@/lib/partner-pin";
import { issuePinLink, partnerByPinLink, partnerBySetupLink } from "@/lib/partner-pin-links";
import { endAllPartnerSessions, endPartnerSession, startPartnerSession } from "@/lib/partner-session";
import { codeFor, referralLink } from "@/lib/partners";
import { normalisePhone } from "@/lib/phone";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { PARTNER_REACH } from "@/lib/referral";
import { helpPhone, siteUrl } from "@/lib/site";

/**
 * Refer & Earn accounts. A partner registers with their phone number and a
 * 6-digit PIN, and logs in with the same two on any phone, the way OPay and
 * the banks do it; their phone stays logged in until they log out. Email is
 * optional, and only ever used to send a link to reset a forgotten PIN.
 */

const PHONE_HELP = "Please enter your phone number, e.g. 0803 123 4567";
const WRONG = "Wrong phone number or PIN.";

const lagosTime = (d: Date) => d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
const lockedMessage = (until: Date) => `Too many wrong PINs. Try again after ${lagosTime(until)}, or reset your PIN.`;

/** Postgres unique-violation on the code index: another partner drew the same code. */
function isCodeCollision(e: unknown): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const pg = err.cause ?? err;
  return pg.code === "23505" && pg.constraint_name === "partners_code_idx";
}

/** A new partner is welcomed after the reply has gone: a slow or failing email never delays the registration. */
function welcome(partnerId: string) {
  after(async () => {
    try {
      await notifyPartnerWelcome(partnerId);
    } catch (e) {
      console.error("[partners] welcome failed", e);
    }
  });
}

/** Emails a one-time link to choose or reset the PIN, when the partner gave an email and none went out in the last ten minutes. */
function emailPinLink(partner: { id: string; email: string | null; pinHash: string | null }) {
  if (!partner.email) return;
  after(async () => {
    try {
      const link = await issuePinLink(partner.id);
      if (link) await notifyPinLink(partner.id, link, partner.pinHash ? "reset" : "set");
    } catch (e) {
      console.error("[partners] PIN link failed", e);
    }
  });
}

/** The PIN and its repeat, checked together: a reason for whichever is wrong, or nothing. */
function pinErrors(pin: string, pinAgain: string, phone: string | null): Record<string, string> | null {
  const problem = pinProblem(pin, phone);
  if (problem) return { pin: problem };
  if (pin !== pinAgain) return { pinAgain: "The two PINs are not the same. Type it again." };
  return null;
}

/* ── Register ──────────────────────────────────────────────────────────── */

export interface PartnerFormResult {
  ok: boolean;
  name?: string;
  code?: string;
  link?: string;
  /** This phone number was already registered; the existing code is returned, and nobody is logged in. */
  returning?: boolean;
  /** A new partner, now logged in on this phone. */
  loggedIn?: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
}

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().max(40),
  pin: z.string().max(12).default(""),
  pinAgain: z.string().max(12).default(""),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  reach: z.enum(PARTNER_REACH, "Tell us where you expect to find buyers"),
  agree: z.literal("yes", "Please confirm you have read the programme rules"),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/** What goes back into the form after a mistake: never the PIN. */
const NOT_ECHOED = new Set(["website", "renderedAt", "pin", "pinAgain"]);

export async function registerPartner(_prev: PartnerFormResult | null, formData: FormData): Promise<PartnerFormResult> {
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && !NOT_ECHOED.has(k))) as Record<string, string>;
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
    return { ok: false, fieldErrors, values };
  }
  const v = parsed.data;
  const firstName = v.name.split(" ")[0];
  // A bot gets something that looks like success: a code that does nothing. Nothing is saved and nobody is logged in.
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, name: firstName, code: "RECEIV", link: referralLink(siteUrl(), "RECEIV") };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: PHONE_HELP }, values };
  // Counted after the bot check, so a bot keeps its decoy and never uses up the allowance real people share.
  if (!(await withinLimit("partner"))) return { ok: false, error: RATE_LIMITED_MESSAGE, values };

  try {
    const dealerId = await sabicarsDealerId();
    const byPhone = and(eq(partners.dealerId, dealerId), eq(partners.phone, phone));
    const [existing] = await db.select({ code: partners.code, status: partners.status }).from(partners).where(byPhone).limit(1);
    if (existing) {
      if (existing.status !== "active") return { ok: false, error: `This number cannot be registered online. Please call ${helpPhone}.`, values };
      // Typing a registered number never logs anyone in: the public code is shown, and the way in is Log in with the PIN.
      return { ok: true, name: firstName, code: existing.code, link: referralLink(siteUrl(), existing.code), returning: true };
    }

    const bad = pinErrors(v.pin, v.pinAgain, phone);
    if (bad) return { ok: false, fieldErrors: bad, values };
    const pinHash = await hashPin(v.pin);

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = codeFor(v.name, attempt);
      try {
        const [row] = await db
          .insert(partners)
          .values({ dealerId, code, name: v.name, phone, email: v.email || null, reach: v.reach, pinHash, pinSetAt: new Date() })
          .returning({ id: partners.id });
        await startPartnerSession(row.id);
        welcome(row.id);
        return { ok: true, name: firstName, code, link: referralLink(siteUrl(), code), loggedIn: true };
      } catch (e) {
        if (isCodeCollision(e)) continue;
        // Two submissions for one phone at once: the other one won; return its code.
        const [raced] = await db.select({ code: partners.code }).from(partners).where(byPhone).limit(1);
        if (raced) return { ok: true, name: firstName, code: raced.code, link: referralLink(siteUrl(), raced.code), returning: true };
        throw e;
      }
    }
    throw new Error("Could not draw a free partner code");
  } catch (e) {
    console.error("[partners] registration failed", e);
    return { ok: false, error: `Something went wrong registering you. Please try again, or call ${helpPhone}.`, values };
  }
}

/* ── Log in ────────────────────────────────────────────────────────────── */

export interface LogInResult {
  error?: string;
  fieldErrors?: { phone?: string; pin?: string };
  /** What was typed in the phone box, to put back. Never the PIN. */
  phone?: string;
  /** A partner who joined before PINs: a link to choose one went to their email, or they must ask Sabicars for it. */
  needsPin?: "emailed" | "call";
}

const logInSchema = z.object({
  phone: z.string().trim().max(40).default(""),
  pin: z.string().max(12).default(""),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
  next: z.string().max(40).optional(),
});

/** Where a partner may land after logging in: their page, or the cars they share. Nothing else, so the field cannot send anyone elsewhere. */
const AFTER_LOG_IN = new Set(["/partner", "/partner/cars"]);

export async function logInPartner(_prev: LogInResult | null, formData: FormData): Promise<LogInResult> {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: { phone: PHONE_HELP } };
  const v = parsed.data;
  // A bot is told what a wrong guess is told, and nothing is looked up.
  if (looksAutomated(v.website, v.renderedAt)) return { error: WRONG, phone: v.phone };
  const phone = normalisePhone(v.phone);
  if (!phone) return { fieldErrors: { phone: PHONE_HELP }, phone: v.phone };
  if (!/^[0-9]{6}$/.test(v.pin)) return { fieldErrors: { pin: "Your PIN is 6 numbers." }, phone: v.phone };
  if (!(await withinLimit("partnerlogin"))) return { error: RATE_LIMITED_MESSAGE, phone: v.phone };

  const [p] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.dealerId, await sabicarsDealerId()), eq(partners.phone, phone)))
    .limit(1);
  if (!p) return { error: WRONG, phone: v.phone };
  if (!p.pinHash) {
    emailPinLink(p);
    return { needsPin: p.email ? "emailed" : "call", phone: v.phone };
  }
  const now = new Date();
  if (p.pinLockedUntil && p.pinLockedUntil > now) return { error: lockedMessage(p.pinLockedUntil), phone: v.phone };

  if (!(await verifyPin(v.pin, p.pinHash))) {
    // Counted in the database, so tries spread over several servers at once all count.
    const [counted] = await db
      .update(partners)
      .set({ pinFailedCount: sql`${partners.pinFailedCount} + 1` })
      .where(eq(partners.id, p.id))
      .returning({ failed: partners.pinFailedCount });
    const failed = counted?.failed ?? p.pinFailedCount + 1;
    const lockFor = lockMinutesAfter(failed);
    if (lockFor) {
      const until = new Date(now.getTime() + lockFor * 60_000);
      await db.update(partners).set({ pinLockedUntil: until }).where(eq(partners.id, p.id));
      return { error: lockedMessage(until), phone: v.phone };
    }
    const left = triesLeft(failed);
    return { error: left <= 2 ? `${WRONG} ${left} ${left === 1 ? "try" : "tries"} left before it locks for a while.` : WRONG, phone: v.phone };
  }

  await db.update(partners).set({ pinFailedCount: 0, pinLockedUntil: null }).where(eq(partners.id, p.id));
  await startPartnerSession(p.id);
  redirect(v.next && AFTER_LOG_IN.has(v.next) ? v.next : "/partner");
}

/* ── Forgot the PIN ────────────────────────────────────────────────────── */

export interface PinLinkResult {
  /** The request was taken. The answer is the same whether or not the number is registered. */
  sent?: boolean;
  error?: string;
  fieldError?: string;
  phone?: string;
}

const forgotSchema = z.object({ phone: z.string().trim().max(40).default(""), website: z.string().optional(), renderedAt: z.coerce.number().optional() });

export async function requestPinLink(_prev: PinLinkResult | null, formData: FormData): Promise<PinLinkResult> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldError: PHONE_HELP };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { sent: true };
  const phone = normalisePhone(v.phone);
  if (!phone) return { fieldError: PHONE_HELP, phone: v.phone };
  if (!(await withinLimit("partnerlogin"))) return { error: RATE_LIMITED_MESSAGE, phone: v.phone };
  try {
    const [p] = await db
      .select({ id: partners.id, email: partners.email, pinHash: partners.pinHash, status: partners.status })
      .from(partners)
      .where(and(eq(partners.dealerId, await sabicarsDealerId()), eq(partners.phone, phone)))
      .limit(1);
    if (p && p.status === "active") emailPinLink(p);
    return { sent: true };
  } catch (e) {
    console.error("[partners] PIN link request failed", e);
    return { error: `Something went wrong. Please try again, or call ${helpPhone}.`, phone: v.phone };
  }
}

/* ── Choose a PIN ──────────────────────────────────────────────────────── */

export interface SetPinResult {
  error?: string;
  fieldErrors?: { pin?: string; pinAgain?: string };
}

const setPinSchema = z.object({
  via: z.enum(["setup", "link"]),
  secret: z.string().max(80),
  pin: z.string().max(12).default(""),
  pinAgain: z.string().max(12).default(""),
});

/**
 * Sets the PIN from a set-up link (a partner with no PIN yet) or a one-time
 * emailed link (a forgotten PIN). Either way the partner is logged in on this
 * phone after; a reset also logs them out everywhere else.
 */
export async function setPartnerPin(_prev: SetPinResult | null, formData: FormData): Promise<SetPinResult> {
  const parsed = setPinSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "This link is not valid. Ask for a new one." };
  const v = parsed.data;
  if (v.via === "link" && !looksLikeSecret(v.secret)) return { error: "This link is not valid. Ask for a new one." };
  if (!(await withinLimit("partnerlogin"))) return { error: RATE_LIMITED_MESSAGE };

  const p = v.via === "link" ? await partnerByPinLink(v.secret) : await partnerBySetupLink(v.secret);
  if (!p) return { error: v.via === "link" ? "This link has expired. Ask for a new one." : "This link is not valid. Ask Sabicars for a new one." };
  if (v.via === "setup" && p.pinHash) return { error: "A PIN is already set for this account. Log in with it, or reset it." };

  const bad = pinErrors(v.pin, v.pinAgain, p.phone);
  if (bad) return { fieldErrors: bad };

  const pinHash = await hashPin(v.pin);
  await db
    .update(partners)
    .set({ pinHash, pinSetAt: new Date(), pinFailedCount: 0, pinLockedUntil: null, pinResetHash: null, pinResetExpiresAt: null, updatedAt: new Date() })
    .where(eq(partners.id, p.id));
  // A new PIN ends every session the old one opened, on every phone.
  await endAllPartnerSessions(p.id);
  await startPartnerSession(p.id);
  redirect("/partner");
}

/* ── Log out ───────────────────────────────────────────────────────────── */

export async function logOutPartner(): Promise<void> {
  await endPartnerSession();
  redirect("/");
}
