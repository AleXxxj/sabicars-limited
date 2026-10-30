"use server";

import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { CALLBACK_NAME } from "@/lib/lead-labels";
import { DECOY_REFERENCE, looksAutomated, saveLead, saveViewing, SlotTaken, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";
import { RATE_LIMITED_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { helpPhone } from "@/lib/site";
import { vehicleTitle } from "@/lib/vehicle";
import { confirmViewingByEmail } from "@/lib/viewing-reminders";
import { isBookableSlot } from "@/lib/viewings";

/**
 * The three ways to enquire from a car's page, one card, one action:
 * a call-back (a number, nothing else), a question, or a viewing.
 */
export type EnquiryKind = "callback" | "question" | "viewing";

export interface EnquiryResult {
  ok: boolean;
  /** Which way the buyer chose, so the confirmation can speak to it. */
  kind?: EnquiryKind;
  /** Shown to the customer and quoted on WhatsApp, so a chat can be matched to its record. */
  reference?: string;
  name?: string;
  /** For a call-back: the number as typed, so the confirmation can repeat it back. */
  phone?: string;
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
  type: z.enum(["callback", "question", "viewing"]),
  // A call-back asks for no name; the other two insist on one (checked below, once the kind is known).
  name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]).default(""),
  preferredContact: z.enum(["phone", "whatsapp"]).catch("phone"),
  message: z.string().trim().max(2000).optional(),
  viewingAt: z.string().max(40).optional(),
  landingPath: z.string().max(300).optional(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

const PHONE_ERROR = "Please enter a phone number we can call, e.g. 0803 123 4567";
const SLOT_ERROR = "Choose a day and time for your viewing.";

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
    // Every field the buyer can see gets its own line; anything else falls back to one plain message,
    // so a refused send is never silent.
    const fieldErrors = {
      name: flat.name?.[0],
      phone: flat.phone ? PHONE_ERROR : undefined,
      email: flat.email?.[0],
      message: flat.message?.[0],
      viewingAt: flat.viewingAt ? SLOT_ERROR : undefined,
    };
    const shown = Object.values(fieldErrors).some(Boolean);
    return { ok: false, fieldErrors, error: shown ? undefined : "Please reload the page and try again.", values };
  }
  const v = parsed.data;
  const kind = v.type;
  if (kind !== "callback" && v.name.length < 2) return { ok: false, kind, fieldErrors: { name: "Please tell us your name" }, values };
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, kind, reference: DECOY_REFERENCE, name: v.name, phone: values.phone };

  // A viewing is for a real slot: one the showroom can keep, checked here as well as in the form.
  const viewingAt = kind === "viewing" && v.viewingAt ? new Date(v.viewingAt) : null;
  if (kind === "viewing" && (!viewingAt || !isBookableSlot(viewingAt))) {
    return { ok: false, kind, fieldErrors: { viewingAt: SLOT_ERROR }, values };
  }

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, kind, fieldErrors: { phone: PHONE_ERROR }, values };
  if (await tooManyFrom(phone)) {
    return { ok: false, kind, error: "We already have several enquiries from this number in the last hour — our team will be in touch.", values };
  }
  // The ceiling per connection comes after the per-number check, so one person resending is told the kinder,
  // more precise thing, and does not use up the allowance shared by everyone on their mobile network.
  if (!(await withinLimit("enquiry"))) return { ok: false, kind, error: RATE_LIMITED_MESSAGE, values };

  const [vehicle] = await db
    .select({ id: vehicles.id, dealerId: vehicles.dealerId, year: vehicles.year, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(and(eq(vehicles.id, v.vehicleId), inArray(vehicles.status, ["available", "reserved", "sold"])))
    .limit(1);
  if (!vehicle) return { ok: false, kind, error: "This vehicle is no longer listed. Please reload the page.", values };

  // A call-back is an enquiry like any other — saved with a reference, the staff alerted, the response
  // clock running — so it is never a number lost in someone's phone. It just carries less.
  const lead =
    kind === "callback"
      ? {
          dealerId: vehicle.dealerId,
          type: "question" as const,
          channel: "web_form" as const,
          vehicleId: vehicle.id,
          name: CALLBACK_NAME,
          phone,
          email: null,
          message: `Please call me back about the ${vehicleTitle(vehicle)}.`,
          preferredContact: "phone",
          landingPath: v.landingPath ?? null,
        }
      : {
          dealerId: vehicle.dealerId,
          type: kind,
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
      const { id, reference } = await saveViewing({ ...lead, viewingAt });
      // The buyer's copy of the booking, straight away — the time, the place, the reference, a calendar
      // link — for anyone who gave an email. Layered on after the reply, so it can never delay or cost the booking.
      if (lead.email) {
        after(async () => {
          const sent = await confirmViewingByEmail(id);
          if (!sent.ok && sent.error !== "not_configured") console.error("[enquiry] viewing confirmation email failed", reference, sent.error);
        });
      }
      return { ok: true, kind, reference, name: v.name.split(" ")[0], viewingAt: viewingAt.toISOString() };
    }
    const reference = await saveLead(lead);
    return { ok: true, kind, reference, name: v.name.split(" ")[0], phone: values.phone };
  } catch (e) {
    if (e instanceof SlotTaken) {
      return { ok: false, kind, fieldErrors: { viewingAt: "That time has just been booked. Please choose another." }, values };
    }
    console.error("[enquiry] insert failed", e);
    return { ok: false, kind, error: `Something went wrong saving your enquiry. Please call ${helpPhone} and we will help straight away.`, values };
  }
}
