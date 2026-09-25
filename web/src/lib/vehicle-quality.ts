import type { Vehicle } from "@/db/schema";

/**
 * What stands between a listing and a sale, in the order a salesperson should
 * fix it. The legacy import produced a one-off report of these; here the same
 * rules run live, so the admin always shows what is missing now.
 *
 * "fix" blocks a good listing; "check" is worth a second look.
 */
export interface Attention {
  level: "fix" | "check";
  message: string;
}

/** A buyer scrolls through a car before they call. Fewer than this and they move on. */
const MIN_PHOTOS = 5;

export function attentionFor(v: Pick<Vehicle, "year" | "condition" | "body" | "description" | "priceMinor" | "mileageKm" | "createdAt">, photoCount: number): Attention[] {
  const out: Attention[] = [];
  if (photoCount === 0) out.push({ level: "fix", message: "No photos — buyers skip listings without them" });
  else if (photoCount < MIN_PHOTOS) out.push({ level: "fix", message: `Only ${photoCount} photo${photoCount === 1 ? "" : "s"} — add at least ${MIN_PHOTOS}` });
  if (!v.body) out.push({ level: "fix", message: "Body type not set — the car is missing from type filters" });
  if (!v.description) out.push({ level: "fix", message: "No description" });
  if (!v.priceMinor) out.push({ level: "check", message: "Price on request — listings with a price get more enquiries" });
  if (v.condition === "brand_new" && v.year < new Date(v.createdAt).getFullYear() - 2) {
    out.push({ level: "check", message: `Marked brand new, but it is a ${v.year} model` });
  }
  if (v.condition !== "brand_new" && !v.mileageKm) out.push({ level: "check", message: "Mileage not recorded" });
  return out;
}
