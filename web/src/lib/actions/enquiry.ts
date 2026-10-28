"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { DECOY_REFERENCE, looksAutomated, saveLead, saveViewing, SlotTaken, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { helpPhone } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";
import { isBookableSlot } from "@/lib/viewings";

export interface EnquiryResult {
  ok: boolean;
  /** Shown to the customer and quoted on WhatsApp, so a chat can be matched to its record. */
  reference?: string;
  name?: string;
  /** For a booked viewing: when (ISO), so the confirmation and the calendar file can say so. */
  viewingAt?: string;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "phone" | "email" | "message" | "viewingAt", string>>;
  /**
   * What was submitted, returned on failure. React resets a form after every
   * submission, so without this a customer who mistypes their phone number
   * would have to type everything again.
   */
  values?: Partial<Record<"name" | "phone" | "email" | "message" | "preferredContact" | "type" | "viewingAt", string>>;
}

const schema = z.object({
  vehicleId: z.uuid(),
  type: z.enum(["question", "viewing"]),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["phone", "whatsapp"]).catch("phone"),
  message: z.string().trim().max(2000).optional(),
  viewingAt: z.string().max(40).optional(),
  landingPath: z.string().max(300).optional(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

const callBackSchema = z.object({
  vehicleId: z.uuid(),
  phone: z.string().trim().max(40),
  landingPath: z.string().max(300).optional(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

export interface CallBackResult {
  ok: boolean;
  reference?: string;
  error?: string;
  phone: string;
}

/**
 * "Call me back": one field, a phone number. The fastest way to a person on
 * the page, and faster than a marketplace chat that demands a typed message
 * or a call-back that needs an account. It is still an enquiry like any
 * other — saved with a reference, the staff alerted, the response clock
 * running — so it is never a number lost in someone's phone.
 */
export async function requestCallBack(_prev: CallBackResult | null, formData: FormData): Promise<CallBackResult> {
  const typed = String(formData.get("phone") ?? "");
  const parsed = callBackSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Please reload the page and try again.", phone: typed };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, phone: typed };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, error: "Please enter a phone number we can call, e.g. 0803 123 4567", phone: typed };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several enquiries from this number in the last hour — our team will be in touch.", phone: typed };
  if (!(await withinLimit("enquiry"))) return { ok: false, error: RATE_LIMITED_MESSAGE, phone: typed };

  const [vehicle] = await db
    .select({ id: vehicles.id, dealerId: vehicles.dealerId, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(and(eq(vehicles.id, v.vehicleId), inArray(vehicles.status, ["available", "reserved"])))
    .limit(1);
  if (!vehicle) return { ok: false, error: "This vehicle is no longer listed. Please reload the page.", phone: typed };

  try {
    const reference = await saveLead({
      dealerId: vehicle.dealerId,
      type: "question",
      channel: "web_form",
      vehicleId: vehicle.id,
      name: "Call me back",
      phone,
      email: null,
      message: `Please call me back about the ${vehicleTitle(vehicle)}.`,
      preferredContact: "phone",
      landingPath: v.landingPath ?? null,
    });
    return { ok: true, reference, phone: typed };
  } catch (e) {
    console.error("[call-back] insert failed", e);
    return { ok: false, error: `Something went wrong. Please call ${helpPhone} and we will help straight away.`, phone: typed };
  }
}

export async function submitEnquiry(_prev: EnquiryResult | null, formData: FormData): Promise<EnquiryResult> {
  const text = (k: string) => String(formData.get(k) ?? "");
  const values = {
    name: text("name"),
    phone: text("phone"),
    email: text("email"),
    message: text("message"),
    preferredContact: text("preferredContact"),
    type: text("type"),
    viewingAt: text("viewingAt"),
  };
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

  // A viewing is for a real slot: one the showroom can keep, checked here as well as in the form.
  const viewingAt = v.type === "viewing" && v.viewingAt ? new Date(v.viewingAt) : null;
  if (v.type === "viewing" && (!viewingAt || !isBookableSlot(viewingAt))) {
    return { ok: false, fieldErrors: { viewingAt: "Choose a day and time for your viewing." }, values };
  }

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  if (await tooManyFrom(phone)) {
    return { ok: false, error: "We already have several enquiries from this number in the last hour — our team will be in touch.", values };
  }
  // The ceiling per connection comes after the per-number check, so one person resending is told the kinder,
  // more precise thing, and does not use up the allowance shared by everyone on their mobile network.
  if (!(await withinLimit("enquiry"))) return { ok: false, error: RATE_LIMITED_MESSAGE, values };

  const [vehicle] = await db
    .select({ id: vehicles.id, dealerId: vehicles.dealerId })
    .from(vehicles)
    .where(and(eq(vehicles.id, v.vehicleId), inArray(vehicles.status, ["available", "reserved", "sold"])))
    .limit(1);
  if (!vehicle) return { ok: false, error: "This vehicle is no longer listed. Please reload the page.", values };

  const lead = {
    dealerId: vehicle.dealerId,
    type: v.type,
    channel: "web_form" as const,
    vehicleId: vehicle.id,
    name: v.name,
    phone,
    email: v.email || null,
    message: v.message || null,
    preferredContact: v.preferredContact,
    landingPath: v.landingPath ?? null,
  };
  try {
    if (viewingAt) {
      const reference = await saveViewing({ ...lead, viewingAt });
      return { ok: true, reference, name: v.name.split(" ")[0], viewingAt: viewingAt.toISOString() };
    }
    const reference = await saveLead(lead);
    return { ok: true, reference, name: v.name.split(" ")[0] };
  } catch (e) {
    if (e instanceof SlotTaken) {
      return { ok: false, fieldErrors: { viewingAt: "That time has just been booked. Please choose another." }, values };
    }
    console.error("[enquiry] insert failed", e);
    return { ok: false, error: `Something went wrong saving your enquiry. Please call ${helpPhone} and we will help straight away.`, values };
  }
}
