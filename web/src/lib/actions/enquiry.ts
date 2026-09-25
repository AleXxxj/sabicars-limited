"use server";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, vehicles } from "@/db/schema";
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

/** Faster than any person fills in a form: a bot. */
const MIN_FILL_MS = 3_000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const schema = z.object({
  vehicleId: z.uuid(),
  type: z.enum(["question", "viewing"]),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["phone", "whatsapp"]).catch("phone"),
  message: z.string().trim().max(2000).optional(),
  landingPath: z.string().max(300).optional(),
  // Anti-spam: a field humans never see, and the time the form was shown.
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * SC- plus the first six characters of the lead id: short enough to read down a
 * phone. Not exported — every export of a "use server" file is a public endpoint.
 */
function referenceFor(leadId: string): string {
  return `SC-${leadId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

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

  // A bot filled the hidden field or submitted inhumanly fast. Report success
  // so it learns nothing, and store nothing.
  if (v.website || (v.renderedAt && Date.now() - v.renderedAt < MIN_FILL_MS)) {
    return { ok: true, reference: "SC-RECEIVED", name: v.name };
  }

  const phone = normalisePhone(v.phone);
  if (!phone) {
    return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  }

  // Keyed on the phone number, not the IP address: Nigerian mobile networks put
  // many real customers behind one address, and limiting by IP would silently
  // turn genuine buyers away.
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.phone, phone), gte(leads.createdAt, since)));
  if (recent >= RATE_LIMIT) {
    return { ok: false, error: "We already have several enquiries from this number in the last hour — our team will be in touch.", values };
  }

  const [vehicle] = await db
    .select({ id: vehicles.id, dealerId: vehicles.dealerId, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(and(eq(vehicles.id, v.vehicleId), inArray(vehicles.status, ["available", "reserved", "sold"])))
    .limit(1);
  if (!vehicle) return { ok: false, error: "This vehicle is no longer listed. Please reload the page.", values };

  // The database write is the commitment to the customer. Alerting staff
  // (architecture phase 3) is layered on top and can never cost the lead.
  try {
    const [row] = await db
      .insert(leads)
      .values({
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
      })
      .returning({ id: leads.id });
    return { ok: true, reference: referenceFor(row.id), name: v.name.split(" ")[0] };
  } catch (e) {
    console.error("[enquiry] insert failed", e);
    return { ok: false, error: "Something went wrong saving your enquiry. Please call 0810 188 5558 and we will help straight away.", values };
  }
}
