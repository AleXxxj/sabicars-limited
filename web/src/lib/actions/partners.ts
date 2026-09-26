"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { looksAutomated, sabicarsDealerId } from "@/lib/leads";
import { codeFor, referralLink } from "@/lib/partners";
import { normalisePhone } from "@/lib/phone";
import { PARTNER_REACH } from "@/lib/referral";
import { siteUrl } from "@/lib/site";

export interface PartnerFormResult {
  ok: boolean;
  name?: string;
  code?: string;
  link?: string;
  /** This phone number was already registered; the existing code is returned. */
  returning?: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
}

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  reach: z.enum(PARTNER_REACH, "Tell us where you expect to find buyers"),
  agree: z.literal("yes", "Please confirm you have read the programme rules"),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/** Postgres unique-violation on the code index: another partner drew the same code. */
function isCodeCollision(e: unknown): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const pg = err.cause ?? err;
  return pg.code === "23505" && pg.constraint_name === "partners_code_idx";
}

export async function registerPartner(_prev: PartnerFormResult | null, formData: FormData): Promise<PartnerFormResult> {
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && k !== "website" && k !== "renderedAt")) as Record<string, string>;
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
    return { ok: false, fieldErrors, values };
  }
  const v = parsed.data;
  const firstName = v.name.split(" ")[0];
  // A bot gets something that looks like success and a code that does nothing.
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, name: firstName, code: "RECEIV", link: referralLink(siteUrl(), "RECEIV") };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter your phone number, e.g. 0803 123 4567" }, values };

  try {
    const dealerId = await sabicarsDealerId();
    const byPhone = and(eq(partners.dealerId, dealerId), eq(partners.phone, phone));
    const [existing] = await db.select({ code: partners.code, status: partners.status }).from(partners).where(byPhone).limit(1);
    if (existing) {
      if (existing.status !== "active") return { ok: false, error: "This number cannot be registered online. Please call 0810 188 5558.", values };
      return { ok: true, name: firstName, code: existing.code, link: referralLink(siteUrl(), existing.code), returning: true };
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = codeFor(v.name, attempt);
      try {
        await db.insert(partners).values({ dealerId, code, name: v.name, phone, email: v.email || null, reach: v.reach });
        return { ok: true, name: firstName, code, link: referralLink(siteUrl(), code) };
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
    return { ok: false, error: "Something went wrong registering you. Please try again, or call 0810 188 5558.", values };
  }
}
