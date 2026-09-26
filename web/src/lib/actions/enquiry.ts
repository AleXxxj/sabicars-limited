"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { DECOY_REFERENCE, looksAutomated, saveLead, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";

export interface EnquiryResult {
  ok: boolean;
  /** Shown to the customer and quoted on WhatsApp, so a chat can be matched to its record. */
  reference?: string;
  name?: string;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "phone" | "email" | "message", string>>;
  /**
   * What was submitted, returned on failure. React resets a form after every
   * submission, so without this a customer who mistypes their phone number
   * would have to type everything again.
   */
  values?: Partial<Record<"name" | "phone" | "email" | "message" | "preferredContact", string>>;
}

const schema = z.object({
  vehicleId: z.uuid(),
  type: z.enum(["question", "viewing"]),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["phone", "whatsapp"]).catch("phone"),
  message: z.string().trim().max(2000).optional(),
  landingPath: z.string().max(300).optional(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

export async function submitEnquiry(_prev: EnquiryResult | null, formData: FormData): Promise<EnquiryResult> {
  const text = (k: string) => String(formData.get(k) ?? "");
  const values = { name: text("name"), phone: text("phone"), email: text("email"), message: text("message"), preferredContact: text("preferredContact") };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      fieldErrors: { name: flat.name?.[0], email: flat.email?.[0], message: flat.message?.[0] },
      error: flat.vehicleId ? "Please reload the page and try again." : undefined,
      values,
    };
  }
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, name: v.name };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  if (await tooManyFrom(phone)) {
    return { ok: false, error: "We already have several enquiries from this number in the last hour — our team will be in touch.", values };
  }

  const [vehicle] = await db
    .select({ id: vehicles.id, dealerId: vehicles.dealerId })
    .from(vehicles)
    .where(and(eq(vehicles.id, v.vehicleId), inArray(vehicles.status, ["available", "reserved", "sold"])))
    .limit(1);
  if (!vehicle) return { ok: false, error: "This vehicle is no longer listed. Please reload the page.", values };

  try {
    const reference = await saveLead({
      dealerId: vehicle.dealerId,
      type: v.type,
      channel: "web_form",
      vehicleId: vehicle.id,
      name: v.name,
      phone,
      email: v.email || null,
      message: v.message || null,
      preferredContact: v.preferredContact,
      landingPath: v.landingPath ?? null,
    });
    return { ok: true, reference, name: v.name.split(" ")[0] };
  } catch (e) {
    console.error("[enquiry] insert failed", e);
    return { ok: false, error: "Something went wrong saving your enquiry. Please call 0810 188 5558 and we will help straight away.", values };
  }
}
