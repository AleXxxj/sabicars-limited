"use server";

import { z } from "zod";
import { DECOY_REFERENCE, looksAutomated, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { beginReservation, type BeginResult } from "@/lib/reserve";

export interface ReserveFormResult {
  ok: boolean;
  /** Where the buyer goes to pay; the browser follows it. */
  url?: string;
  /** The team will arrange a bank transfer: no payment page. */
  arranged?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "phone" | "email" | "amount", string>>;
  values?: Partial<Record<"name" | "phone" | "email" | "amount", string>>;
}

const schema = z.object({
  slug: z.string().min(1).max(200),
  amount: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.email("We need a working email for your receipt").max(200),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/** The reserve form: checks, then a payment page to go to, or the team to arrange it. */
export async function startReservation(_prev: ReserveFormResult | null, formData: FormData): Promise<ReserveFormResult> {
  const text = (k: string) => String(formData.get(k) ?? "");
  const values = { name: text("name"), phone: text("phone"), email: text("email"), amount: text("amount") };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, fieldErrors: { name: flat.name?.[0], email: flat.email?.[0], amount: flat.amount ? "Choose a deposit." : undefined }, values };
  }
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, arranged: true, reference: DECOY_REFERENCE };
  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several enquiries from this number in the last hour. Our team will be in touch.", values };
  if (!(await withinLimit("enquiry"))) return { ok: false, error: RATE_LIMITED_MESSAGE, values };

  const result: BeginResult = await beginReservation({
    slug: v.slug,
    amountMinor: v.amount,
    name: v.name,
    phone,
    email: v.email,
    landingPath: `/reserve/${v.slug}`,
  });
  if (!result.ok) return { ok: false, error: result.error, values };
  if (result.kind === "pay") return { ok: true, url: result.url, reference: result.reference };
  return { ok: true, arranged: true, reference: result.reference };
}
