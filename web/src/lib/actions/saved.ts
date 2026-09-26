"use server";

import { z } from "zod";
import { DECOY_REFERENCE, looksAutomated, sabicarsDealerId, saveWatch, tooManyFrom } from "@/lib/leads";
import { normalisePhone } from "@/lib/phone";
import { toCard, vehiclesBySlugs, type CardVehicle } from "@/lib/repositories/vehicles";
import { vehicleTitle } from "@/lib/vehicle";

const SLUG = /^[a-z0-9-]{1,120}$/;

function cleanSlugs(input: unknown): string[] {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  return [...new Set(list.map((s) => String(s).trim()).filter((s) => SLUG.test(s)))].slice(0, 50);
}

/** The cars on a visitor's shortlist (which lives in their browser), for the saved page. */
export async function loadSavedVehicles(slugs: string[]): Promise<CardVehicle[]> {
  return (await vehiclesBySlugs(cleanSlugs(slugs))).map(toCard);
}

export interface WatchResult {
  ok: boolean;
  reference?: string;
  name?: string;
  count?: number;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
}

const schema = z.object({
  slugs: z.string(),
  name: z.string().trim().min(2, "Please tell us your name").max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("That email does not look right").max(200)]),
  preferredContact: z.enum(["whatsapp", "phone", "email"]).catch("whatsapp"),
  landingPath: z.string().max(200).optional(),
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * "Tell me if the price drops" — for one car from its page, or the whole
 * shortlist at once. The shortlist itself stays on the device; this is the
 * part that reaches Sabicars, so the buyer hears the moment staff cut a price.
 */
export async function watchVehicles(_prev: WatchResult | null, formData: FormData): Promise<WatchResult> {
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && k !== "website" && k !== "renderedAt")) as Record<string, string>;
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, values, fieldErrors: Object.fromEntries(Object.entries(z.flattenError(parsed.error).fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0]])) };
  }
  const v = parsed.data;
  if (looksAutomated(v.website, v.renderedAt)) return { ok: true, reference: DECOY_REFERENCE, name: v.name, count: 0 };

  const phone = normalisePhone(v.phone);
  if (!phone) return { ok: false, fieldErrors: { phone: "Please enter a phone number we can reach, e.g. 0803 123 4567" }, values };
  if (v.preferredContact === "email" && !v.email) return { ok: false, fieldErrors: { email: "Add your email, or choose another way to hear from us" }, values };

  // Only cars still for sale can drop in price.
  const cars = (await vehiclesBySlugs(cleanSlugs(v.slugs))).filter((c) => c.status === "available" || c.status === "reserved");
  if (!cars.length) return { ok: false, error: "None of these cars is still for sale.", values };
  if (await tooManyFrom(phone)) return { ok: false, error: "We already have several requests from this number in the last hour.", values };

  try {
    const reference = await saveWatch(
      {
        dealerId: await sabicarsDealerId(),
        type: "watch",
        channel: "web_form",
        vehicleId: cars.length === 1 ? cars[0].id : null,
        name: v.name,
        phone,
        email: v.email || null,
        preferredContact: v.preferredContact,
        message: `Watching for a price drop on: ${cars.map((c) => vehicleTitle(c)).join(", ")}.`,
        landingPath: v.landingPath?.startsWith("/") ? v.landingPath : "/saved",
      },
      cars.map((c) => ({ vehicleId: c.id, priceMinor: c.priceMinor })),
    );
    return { ok: true, reference, name: v.name.split(" ")[0], count: cars.length };
  } catch (e) {
    console.error("[watch] insert failed", e);
    return { ok: false, error: "Something went wrong. Please try again.", values };
  }
}
