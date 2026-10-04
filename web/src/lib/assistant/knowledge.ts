import "server-only";
import { cache } from "react";
import type { AskAnswer } from "@/db/schema";
import { formatNaira, money, percentOf } from "@/lib/money";
import { publishedAnswers } from "@/lib/repositories/ask";
import { publishedPosts, type PostCard } from "@/lib/repositories/blog";
import { listedVehicles, type VehicleWithCover } from "@/lib/repositories/vehicles";
import { clockStartsAt, isOpen, showroomHours } from "@/lib/showroom-hours";
import { site } from "@/lib/site";
import { BODY_LABEL, CONDITION_LABEL, DRIVE_PLAN_DEPOSIT_BPS, DRIVETRAIN_LABEL, vehicleTitle } from "@/lib/vehicle";
import type { AssistantCar } from "./parts";

/**
 * Everything Ask Sabicars is allowed to know, read live from the database.
 *
 * It is grounded, not creative, about facts: every car, price and spec it can
 * mention is assembled here from the same rows the public pages render. An
 * assistant that improvises stock will one day promise a buyer a car that was
 * sold last month.
 *
 * Prices arrive already formatted, and the 40% deposit already worked out —
 * arithmetic on money is not something a language model should be doing in
 * front of a customer.
 *
 * The text is built the same way every time for the same stock, so the model
 * provider's prompt cache holds it between conversations.
 */

const NEW_ARRIVAL_DAYS = 21;
const NOTES_CHARS = 420;

function depositMinor(v: Pick<VehicleWithCover, "priceMinor">): number | null {
  return v.priceMinor ? percentOf(money(v.priceMinor, "NGN"), DRIVE_PLAN_DEPOSIT_BPS).minor : null;
}

function gearbox(v: VehicleWithCover): string | null {
  return v.transmission === "automatic" ? "Automatic" : v.transmission === "manual" ? "Manual" : null;
}

function fuelLabel(v: VehicleWithCover): string | null {
  return v.fuel ? v.fuel.charAt(0).toUpperCase() + v.fuel.slice(1) : null;
}

export function toAssistantCar(v: VehicleWithCover): AssistantCar {
  return {
    slug: v.slug,
    title: vehicleTitle(v),
    priceMinor: v.priceMinor,
    wasPriceMinor: v.wasPriceMinor,
    depositMinor: depositMinor(v),
    year: v.year,
    condition: CONDITION_LABEL[v.condition],
    body: v.body ? BODY_LABEL[v.body] : null,
    mileageKm: v.mileageKm,
    engine: v.engine,
    transmission: gearbox(v),
    drivetrain: v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : null,
    fuel: fuelLabel(v),
    seats: v.seats,
    coverUrl: v.cover?.url ?? null,
    reserved: v.status === "reserved",
  };
}

function vehicleEntry(v: VehicleWithCover, now: Date): string {
  const deposit = depositMinor(v);
  const flags = [
    v.status === "reserved" ? "RESERVED (a buyer has paid a deposit; it may come free again)" : null,
    v.wasPriceMinor ? `PRICE REDUCED from ${formatNaira(v.wasPriceMinor)}` : null,
    (now.getTime() - v.createdAt.getTime()) / 86_400_000 <= NEW_ARRIVAL_DAYS ? "New arrival" : null,
    v.segment === "luxury" ? "Luxury" : v.segment === "commercial" ? "Commercial" : null,
  ].filter(Boolean);
  const facts = [
    CONDITION_LABEL[v.condition],
    v.body ? BODY_LABEL[v.body] : null,
    v.mileageKm ? `${v.mileageKm.toLocaleString("en-NG")} km` : "mileage not stated",
    v.engine,
    v.horsepower ? `${v.horsepower} hp` : null,
    v.transmissionDetail ?? gearbox(v),
    v.drivetrain ? DRIVETRAIN_LABEL[v.drivetrain] : null,
    fuelLabel(v),
    v.seats ? `${v.seats} seats` : null,
    [v.exteriorColour, v.interiorColour].filter(Boolean).join(" / ") || null,
  ].filter(Boolean);
  const notes = v.description?.replace(/\s+/g, " ").trim();
  return [
    `### ${vehicleTitle(v)}${v.trim ? ` (${v.trim})` : ""}`,
    `slug: ${v.slug} · page: /vehicles/${v.slug}`,
    `Price: ${v.priceMinor ? formatNaira(v.priceMinor) : "on request"}${deposit ? ` · 40% Drive Plan deposit: ${formatNaira(deposit)}` : ""}${flags.length ? ` · ${flags.join(" · ")}` : ""}`,
    `Facts: ${facts.join(" · ")}`,
    v.features.length ? `Features: ${v.features.join(", ")}` : null,
    notes
      ? `Listing notes (the dealer's own words; may contain errors): ${notes.length > NOTES_CHARS ? `${notes.slice(0, NOTES_CHARS)}…` : notes}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function stockSummary(stock: VehicleWithCover[]): string {
  const priced = stock.filter((v) => v.priceMinor);
  const byBody = new Map<string, number>();
  for (const v of stock) {
    const label = v.body ? BODY_LABEL[v.body] : "Other";
    byBody.set(label, (byBody.get(label) ?? 0) + 1);
  }
  const low = priced[0]?.priceMinor;
  const high = priced.at(-1)?.priceMinor;
  return [
    `${stock.length} vehicles are for sale right now${low && high ? `, from ${formatNaira(low)} to ${formatNaira(high)}` : ""}.`,
    `By body: ${[...byBody].map(([b, n]) => `${b} ${n}`).join(", ")}.`,
    `Makes: ${[...new Set(stock.map((v) => v.make))].sort().join(", ")}.`,
  ].join("\n");
}

function articles(posts: PostCard[]): string {
  return posts.map((p) => `- [${p.title}](/blog/${p.slug}) — ${p.standfirst}`).join("\n");
}

function answers(list: AskAnswer[]): string {
  return list.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
}

/** The stable part of what the assistant knows: the business, the stock, the articles and the published answers. */
export const knowledge = cache(async () => {
  const [stock, posts, published] = await Promise.all([listedVehicles(), publishedPosts(), publishedAnswers()]);
  const now = new Date();
  // Day granularity for "new arrival", so the text (and the prompt cache) stays stable within a day.
  now.setUTCHours(0, 0, 0, 0);
  const bySlug = new Map(stock.map((v) => [v.slug, v]));

  const text = `# Sabicars

${site.legalName} (CAC RC ${site.rcNumber}) sells cars, SUVs, Toyota Hiace "Hummer" buses and trucks from its showroom in Lagos, and supplies fleets to companies and government bodies.

- Showroom: ${site.address.line1}, ${site.address.line2}, ${site.address.city}. Directions: ${site.mapsUrl}
- Hours: ${site.hours.map((h) => `${h.days} ${h.time}`).join("; ")} (Lagos time).
- Phone: ${site.phones.map((p) => p.display).join(" or ")}. WhatsApp: ${site.whatsapp.display}. Email: ${site.email}.
- Every car can be inspected at the showroom before any money changes hands, and buyers are welcome to bring their own mechanic.

## The 40% Drive Plan
- The buyer pays 40% of the price. Autochek, Sabicars' financing partner, finances the other 60%.
- Autochek profiles the buyer and decides the approval, on the terms (rate and tenure) set on the car's Autochek listing. Sabicars does not set or know those terms.
- The car leaves the showroom only once Autochek approves AND the 40% is paid.
- How it works: /drive-plan. On each car's page there is a Drive Plan button.

## Other ways Sabicars helps
- The Sourcing Desk (/find): a buyer describes a car that is not in stock — make, model, year, budget — and is told the moment one arrives.
- Refer & Earn (/partners): anyone can register free, share their link, and earn 1.5% of the price when a buyer they sent completes a purchase.
- Fleet supply (/fleet): companies and government bodies buy in volume, quoted and delivered as one order.
- Price-drop alerts: on any car's page, a buyer can ask to be told if the price drops. Saved cars: the heart on any car.
- Comparisons: any two or three cars can be compared side by side at /compare.

## Useful links
- All stock: /vehicles · SUVs: /vehicles?body=suv · Buses: /vehicles?body=bus · Saloons: /vehicles?body=sedan · Pickups: /vehicles?body=pickup · Trucks: /vehicles?body=truck
- Luxury: /vehicles?segment=luxury · By price: /vehicles?maxPrice=20000000 (whole naira)
- The Hummer bus: /hummer-bus · Contact: /contact · About: /about · Answers to common questions: /ask

## Articles on the site (link to them when they genuinely help)
${articles(posts)}
${published.length ? `\n## Answers Sabicars has published (answer consistently with these)\n${answers(published)}\n` : ""}
## The stock, cheapest first
${stockSummary(stock)}

${stock.map((v) => vehicleEntry(v, now)).join("\n\n")}
`;

  return { text, stock, bySlug };
});

/** What changes by the minute, kept out of the cached text: the time, whether the showroom is open, where the visitor is. */
export function momentContext(page: { path: string | null; vehicle: VehicleWithCover | null }): string {
  const now = new Date();
  const lagos = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long" });
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true });
  const hoursOn = (d: Date) => {
    const { opens, closes } = showroomHours(d);
    return `${clock.format(opens)} to ${clock.format(closes)}`;
  };
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  return [
    `It is ${lagos.format(now)} in Lagos. The showroom is ${isOpen(now) ? `open now, until ${clock.format(showroomHours(now).closes)}` : `closed now; it next opens ${lagos.format(clockStartsAt(now))}`}.`,
    // Spelled out, so "can I come tomorrow?" is answered for tomorrow, not today.
    `Today is ${date.format(now)}: open ${hoursOn(now)}. Tomorrow is ${date.format(tomorrow)}: open ${hoursOn(tomorrow)}. When a buyer names a day, answer for that day.`,
    page.vehicle
      ? `The visitor is on the page for the ${vehicleTitle(page.vehicle)} (slug: ${page.vehicle.slug}). "This car" means that one.`
      : page.path
        ? `The visitor is on the page ${page.path}.`
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}
