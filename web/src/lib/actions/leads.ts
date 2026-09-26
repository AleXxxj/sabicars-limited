"use server";

import { z } from "zod";
import { FLEET_QUANTITIES, FLEET_TIMEFRAMES, FLEET_VEHICLES } from "@/lib/fleet";
import { DECOY_REFERENCE, looksAutomated, recordShownMatches, sabicarsDealerId, saveLead, saveVehicleRequest, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";
import { stockMatching } from "@/lib/repositories/vehicles";
import { budgetLabel, budgetMaxMinor, PAYMENT_OPTIONS } from "@/lib/sourcing";
import { drivePlanDeposit, priceLabel, vehicleTitle } from "@/lib/vehicle";

export interface LeadFormResult {
  ok: boolean;
  reference?: string;
  name?: string;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** What was submitted, so a correction never means typing it all again. */
  values?: Record<string, string>;
}

export interface StockMatch {
  href: string;
  title: string;
  price: string;
  deposit: string | null;
  coverUrl: string | null;
}

const optional = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

function firstErrors(error: z.ZodError): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]]));
}

function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k !== "website" && k !== "renderedAt") out[k] = out[k] ? `${out[k]},${v}` : v;
  return out;
}

/* ── Contact page ──────────────────────────────────────────────────────── */

/** What the visitor says it is about decides which queue it lands in. */
const TOPIC_TYPE = { buying: "question", drive_plan: "drive_plan", fleet: "fleet", general: "contact" } as const;

const contactSchema = z.object({
  topic: z.enum(["buying", "drive_plan", "fleet", "general"]).catch("general"),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["phone", "whatsapp", "email"]).catch("phone"),
  message: z.string().trim().min(5, "Tell us a little about what you need").max(3000),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

export async function submitContact(_prev: LeadFormResult | null, formData: FormData): Promise<LeadFormResult> {
  const values = submitted(formData);
  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, name: v.name };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several messages from this number in the last hour — our team will be in touch.", values };

  try {
    const reference = await saveLead({
      dealerId: await sabicarsDealerId(),
      type: TOPIC_TYPE[v.topic],
      channel: "web_form",
      name: v.name,
      phone,
      email: v.email || null,
      message: v.message,
      preferredContact: v.preferredContact,
      landingPath: "/contact",
    });
    return { ok: true, reference, name: v.name.split(" ")[0] };
  } catch (e) {
    console.error("[contact] insert failed", e);
    return { ok: false, error: "Something went wrong sending your message. Please call 0810 188 5558.", values };
  }
}

/* ── Fleet quotation ───────────────────────────────────────────────────── */

const fleetSchema = z.object({
  organisation: z.string().trim().min(2, "Enter the organisation’s name").max(160),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  role: optional(80),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  vehicles: z.array(z.enum(FLEET_VEHICLES)).min(1, "Choose at least one type of vehicle"),
  quantity: z.enum(FLEET_QUANTITIES, "Choose roughly how many"),
  timeframe: z.enum(FLEET_TIMEFRAMES, "Choose when you need them"),
  deliverTo: optional(120),
  budget: optional(120),
  notes: optional(3000),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

export async function submitFleetRequest(_prev: LeadFormResult | null, formData: FormData): Promise<LeadFormResult> {
  const values = submitted(formData);
  const parsed = fleetSchema.safeParse({ ...Object.fromEntries(formData.entries()), vehicles: formData.getAll("vehicles") });
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, name: v.name };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can call, e.g. 0803 123 4567" }, values };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several requests from this number in the last hour — our team will be in touch.", values };

  // Structured in the message until fleet requests get their own table
  // (architecture phase 6), so staff read it at a glance.
  const brief = [
    `Organisation: ${v.organisation}${v.role ? ` (${v.name}, ${v.role})` : ""}`,
    `Vehicles: ${v.vehicles.join(", ")}`,
    `Quantity: ${v.quantity}`,
    `Needed: ${v.timeframe}`,
    v.deliverTo && `Deliver to: ${v.deliverTo}`,
    v.budget && `Budget: ${v.budget}`,
    v.notes && `Notes: ${v.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const reference = await saveLead({
      dealerId: await sabicarsDealerId(),
      type: "fleet",
      channel: "web_form",
      name: v.name,
      phone,
      email: v.email || null,
      message: brief,
      preferredContact: "phone",
      landingPath: "/fleet",
    });
    return { ok: true, reference, name: v.name.split(" ")[0] };
  } catch (e) {
    console.error("[fleet] insert failed", e);
    return { ok: false, error: "Something went wrong sending your request. Please call 0810 188 5558.", values };
  }
}

/* ── Sourcing Desk ─────────────────────────────────────────────────────── */

const sourcingSchema = z.object({
  want: z.string().trim().min(2, "Tell us which vehicle you are looking for").max(120),
  yearFrom: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1980).max(2100).optional()).catch(undefined),
  budget: z.string().optional(),
  payment: z.enum(["cash", "drive_plan", "undecided"]).catch("undecided"),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["phone", "whatsapp", "email"]).catch("whatsapp"),
  notes: optional(1000),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

export interface SourcingResult extends LeadFormResult {
  /** Vehicles already in stock that answer the request — the desk's first reply. */
  matches?: StockMatch[];
}

export async function submitSourcingRequest(_prev: SourcingResult | null, formData: FormData): Promise<SourcingResult> {
  const values = submitted(formData);
  const parsed = sourcingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, name: v.name };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can reach, e.g. 0803 123 4567" }, values };
  if (v.preferredContact === "email" && !v.email) return { ok: false, fieldErrors: { email: "Add your email, or choose another way to hear from us" }, values };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several requests from this number in the last hour — they are all on the desk.", values };

  const budgetMax = budgetMaxMinor(v.budget);
  // The lead carries a readable summary, so the request makes sense in the
  // inbox on its own; the structured copy is what stock is matched against.
  const summary = [
    `Wants: ${v.want}`,
    v.yearFrom && `Year: ${v.yearFrom} or newer`,
    budgetLabel(v.budget) && `Budget: ${budgetLabel(v.budget)}`,
    `Paying: ${PAYMENT_OPTIONS.find((p) => p.value === v.payment)!.label}`,
    v.notes && `Notes: ${v.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { reference, requestId } = await saveVehicleRequest(
      {
        dealerId: await sabicarsDealerId(),
        type: "sourcing",
        channel: "web_form",
        name: v.name,
        phone,
        email: v.email || null,
        message: summary,
        preferredContact: v.preferredContact,
        landingPath: "/find",
      },
      { want: v.want, yearFrom: v.yearFrom ?? null, budgetMaxMinor: budgetMax, payment: v.payment },
    );
    // Looked up after saving: the request is on record whether or not this succeeds.
    const matches = await stockMatching(v.want, v.yearFrom ?? null, budgetMax).catch(() => []);
    await recordShownMatches(requestId, matches.map((m) => m.id)).catch((e) => console.error("[sourcing] could not record shown matches", e));
    return {
      ok: true,
      reference,
      name: v.name.split(" ")[0],
      matches: matches.map((m) => ({
        href: `/vehicles/${m.slug}`,
        title: vehicleTitle(m),
        price: priceLabel(m),
        deposit: drivePlanDeposit(m),
        coverUrl: m.cover?.url ?? null,
      })),
    };
  } catch (e) {
    console.error("[sourcing] insert failed", e);
    return { ok: false, error: "Something went wrong saving your request. Please call 0810 188 5558.", values };
  }
}
