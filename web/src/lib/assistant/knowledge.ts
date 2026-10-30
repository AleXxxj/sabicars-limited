import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import type { AskAnswer } from "@/db/schema";
import { formatNaira } from "@/lib/money";
import { publishedAnswers } from "@/lib/repositories/ask";
import { publishedPosts, type PostCard } from "@/lib/repositories/blog";
import { reportSummaries } from "@/lib/repositories/inspections";
import { listedVehicles, type VehicleWithCover } from "@/lib/repositories/vehicles";
import { clockStartsAt, isOpen, showroomHours } from "@/lib/showroom-hours";
import { site } from "@/lib/site";
import {
  DEFAULT_ESTIMATE_MONTHS,
  DRIVE_PLAN,
  ESTIMATE_MONTHS,
  MONTHLY_INCLUDES,
  depositMinorFor,
  depositPercentLabel,
  drivePlanTerms,
  monthlyAtCeilingMinor,
} from "@/lib/drive-plan";
import { BODY_LABEL, CONDITION_LABEL, DRIVETRAIN_LABEL, vehicleTitle } from "@/lib/vehicle";
import { CARS_NAV, MAIN_NAV, MORE_NAV } from "@/lib/navigation";
import type { AssistantCar } from "./parts";
import { familyGuide } from "@/lib/hiace-family";

/**
 * Everything Ask Sabicars is allowed to know, read live from the database.
 *
 * It is grounded, not creative, about facts: every car, price and spec it can
 * mention is assembled here from the same rows the public pages render. An
 * assistant that improvises stock will one day promise a buyer a car that was
 * sold last month.
 *
 * Prices arrive already formatted, and each car's own Drive Plan deposit and
 * its monthly estimate at Autochek's published ceiling already worked out —
 * arithmetic on money is not something a language model should be doing in
 * front of a customer.
 *
 * The text is built the same way every time for the same stock, so the model
 * provider's prompt cache holds it between conversations.
 */

const NEW_ARRIVAL_DAYS = 21;
const NOTES_CHARS = 420;
/** The shortest term the site shows an estimate for, so an entry gives the buyer both ends of the range. */
const SHORTEST_ESTIMATE_MONTHS = Math.min(...ESTIMATE_MONTHS);

/** This car's Drive Plan deposit at its model year's tier; null when there is no price or Autochek would not finance it. */
function depositMinor(v: Pick<VehicleWithCover, "priceMinor" | "year">): number | null {
  return depositMinorFor(v.priceMinor, v.year);
}

/**
 * The estimated monthly repayment on this car's financed balance over `months`
 * at Autochek's published ceiling, in kobo; null when the car is not on the
 * plan or has no price. A figure to plan around, never the lender's quote.
 */
function monthlyMinor(v: Pick<VehicleWithCover, "priceMinor" | "year">, months: number): number | null {
  const deposit = depositMinor(v);
  if (deposit === null || !v.priceMinor) return null;
  return monthlyAtCeilingMinor(v.priceMinor - deposit, months);
}

function gearbox(v: VehicleWithCover): string | null {
  return v.transmission === "automatic" ? "Automatic" : v.transmission === "manual" ? "Manual" : null;
}

function fuelLabel(v: VehicleWithCover): string | null {
  return v.fuel ? v.fuel.charAt(0).toUpperCase() + v.fuel.slice(1) : null;
}

export function toAssistantCar(v: VehicleWithCover): AssistantCar {
  const terms = drivePlanTerms(v.year);
  return {
    slug: v.slug,
    title: vehicleTitle(v),
    priceMinor: v.priceMinor,
    wasPriceMinor: v.wasPriceMinor,
    depositMinor: depositMinor(v),
    depositPercent: terms.eligible ? terms.depositPercent : null,
    monthlyMinor: monthlyMinor(v, DEFAULT_ESTIMATE_MONTHS),
    heldOffsite: v.heldOffsite,
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

function vehicleEntry(v: VehicleWithCover, now: Date, report: string | undefined): string {
  const deposit = depositMinor(v);
  const monthlyDefault = monthlyMinor(v, DEFAULT_ESTIMATE_MONTHS);
  const monthlyShortest = monthlyMinor(v, SHORTEST_ESTIMATE_MONTHS);
  const estimate =
    monthlyDefault && monthlyShortest
      ? ` · est. monthly at Autochek's ceiling: ${formatNaira(monthlyDefault)} over ${DEFAULT_ESTIMATE_MONTHS} months, ${formatNaira(monthlyShortest)} over ${SHORTEST_ESTIMATE_MONTHS} months`
      : "";
  const flags = [
    v.status === "reserved" ? "RESERVED (a buyer has paid a deposit; it may come free again)" : null,
    v.wasPriceMinor ? `PRICE REDUCED from ${formatNaira(v.wasPriceMinor)}` : null,
    v.heldOffsite ? "HELD ELSEWHERE (not at the Sabicars showroom): viewing and inspection on request; it does not carry the Sabicars Verified seal" : null,
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
    `Price: ${v.priceMinor ? formatNaira(v.priceMinor) : "on request"}${
      deposit ? ` · Drive Plan deposit (${depositPercentLabel(v.year)}): ${formatNaira(deposit)}${estimate}` : v.priceMinor ? ` · NOT on the Drive Plan (older than ${DRIVE_PLAN.minYear}): full payment only` : ""
    }${flags.length ? ` · ${flags.join(" · ")}` : ""}`,
    `Facts: ${facts.join(" · ")}`,
    v.features.length ? `Features: ${v.features.join(", ")}` : null,
    notes
      ? `Listing notes (the dealer's own words; may contain errors): ${notes.length > NOTES_CHARS ? `${notes.slice(0, NOTES_CHARS)}…` : notes}`
      : null,
    // A car held elsewhere never carries the seal, whatever the inspections table holds for it.
    v.heldOffsite
      ? "Not at the showroom: no Sabicars Verified report; inspected on the buyer's request."
      : (report ?? "No Sabicars Verified report yet: do not call it inspected or verified."),
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

/**
 * Every public page by the name buyers see, read from the one list the header,
 * the tab bar, the More menu and the footer use, so the assistant never sends
 * a buyer to a page by a name the site no longer shows.
 */
const PAGES = [CARS_NAV, ...MAIN_NAV, ...MORE_NAV.flatMap<(typeof MORE_NAV)[number]["items"][number]>((g) => g.items)];
type PageHref = (typeof PAGES)[number]["href"];

/** A page as the assistant should name it: "Request a car (/find)". */
function page(href: PageHref): string {
  return `${PAGES.find((p) => p.href === href)!.label} (${href})`;
}

/**
 * Names from the old site and menus that buyers still use, and the page each
 * one now is. The assistant has to understand them, then answer with the new name.
 */
const OLD_NAMES: [string, PageHref][] = [
  ['"Sourcing Desk"', "/find"],
  ['"Fleet", "Fleet & Government" or "fleet supply"', "/fleet"],
  ['"Insights"', "/blog"],
  ['"Inventory"', "/vehicles"],
  ['"Sell or trade in" or "Sell or swap your car"', "/sell"],
  ['"Find a car"', "/find"],
  ['"Earn"', "/partners"],
  ['"Saved cars"', "/saved"],
  ['"Browse cars"', "/vehicles"],
];

function pageNames(): string {
  return [
    ...PAGES.map((p) => `- ${p.label} (${p.href})${"short" in p ? `, "${p.short}" on the phone's tab bar` : ""}: ${p.hint}`),
    `Older names a buyer may still use: ${OLD_NAMES.map(([old, href]) => `${old} means ${page(href)}`).join("; ")}. Understand them, but answer with the names above.`,
  ].join("\n");
}

function articles(posts: PostCard[]): string {
  return posts.map((p) => `- [${p.title}](/blog/${p.slug}) — ${p.standfirst}`).join("\n");
}

function answers(list: AskAnswer[]): string {
  return list.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
}

/** The stable part of what the assistant knows: the business, the stock, the articles and the published answers. */
/**
 * Built once a minute, not once a message: four queries and the whole stock
 * written out were nearly two seconds before the model was even asked. The
 * cache is cleared the moment staff save a car (TAGS.inventory), so a sold
 * car never lingers; the day-granular "new arrival" keeps the text, and the
 * provider's prompt cache, stable within a day.
 */
const knowledgeFromCache = unstable_cache(
  async (): Promise<{ text: string; stock: VehicleWithCover[] }> => {
    const [stock, posts, published] = await Promise.all([listedVehicles(), publishedPosts(), publishedAnswers()]);
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const reports = await reportSummaries(stock.map((v) => v.id), now);
    return { text: knowledgeText(stock, posts, published, reports, now), stock };
  },
  ["assistant-knowledge"],
  { revalidate: 60, tags: [TAGS.inventory] },
);

export const knowledge = cache(async () => {
  const { text, stock } = await knowledgeFromCache();
  return { text, stock, bySlug: new Map(stock.map((v) => [v.slug, v])) };
});

function knowledgeText(stock: VehicleWithCover[], posts: PostCard[], published: AskAnswer[], reports: Awaited<ReturnType<typeof reportSummaries>>, now: Date): string {
  return `# Sabicars

${site.legalName} (CAC RC ${site.rcNumber}) sells cars, SUVs, Toyota Hiace "Hummer" buses and trucks from its showroom in Lagos, and sells vehicles in bulk to companies and government offices.

- Showroom: ${site.address.line1}, ${site.address.line2}, ${site.address.city}. Directions: ${site.mapsUrl}
- Hours: ${site.hours.map((h) => `${h.days} ${h.time}`).join("; ")} (Lagos time).
- Phone: ${site.phones.map((p) => p.display).join(" or ")}. WhatsApp: ${site.whatsapp.display}. Email: ${site.email}.
- Every car at the showroom can be inspected there before any money changes hands, and buyers are welcome to bring their own mechanic. A car marked HELD ELSEWHERE in its entry is not at the showroom: viewing and an inspection by the Sabicars team are arranged on request, and it does not carry the Sabicars Verified seal.
- Sabicars Verified: the Sabicars team inspects a car at the showroom, every check answered and photographed where needed, and the seal goes only to a car inspected that way. An entry that carries a Sabicars Verified report says so, with its link.
- ${page("/sell")}: someone with a car to sell can sell it to Sabicars, trade it in towards a car in stock, or have Sabicars sell it for them, then send photos on WhatsApp with their reference. Sabicars replies after looking at the car; never quote what a car is worth.
- Viewings: a buyer books a time on the car's own page (Book a viewing), choosing an hourly slot within opening hours, from two hours ahead up to a week ahead. They get a reference and an add-to-calendar link, and, if they gave an email, a confirmation email at once and a reminder on the morning. The same card offers "Call me back" (a phone number alone, and the team calls) and "Ask a question".
- Privacy: chats and enquiries are kept so the team can follow up, and Sabicars does not sell personal data. Anyone can ask to see, correct or delete their details by emailing ${site.email}. The full notice is at /privacy.

## The 40% Drive Plan (Autochek finances the balance)
- The deposit depends on the car's model year: 40% for a car from ${DRIVE_PLAN.standardYear} (Autochek finances 60%); 50% for a ${DRIVE_PLAN.minYear} or ${DRIVE_PLAN.standardYear - 1} car (Autochek finances 50%). Autochek's lenders do not finance cars older than ${DRIVE_PLAN.minYear}: those can only be paid for in full. Each car's entry below states its own deposit, or that it is not on the plan. A buyer may put down more than the minimum (up to ${DRIVE_PLAN.maxDepositBps / 100}%).
- Autochek's lender sets the interest rate and the term when it assesses the buyer. Autochek publishes a ceiling of ${DRIVE_PLAN.maxAnnualRatePercent}% a year and terms of ${DRIVE_PLAN.tenureMonths.min} to ${DRIVE_PLAN.tenureMonths.max} months; the exact rate is given when the buyer applies. Never quote a rate or a monthly figure as fact: say "set by the lender, up to ${DRIVE_PLAN.maxAnnualRatePercent}% a year, over ${DRIVE_PLAN.tenureMonths.min} to ${DRIVE_PLAN.tenureMonths.max} months"; a monthly figure is only ever the estimate described below.
- Monthly estimate: the site shows an estimated monthly repayment at Autochek's published ceiling of ${DRIVE_PLAN.maxAnnualRatePercent}% a year over ${ESTIMATE_MONTHS.slice(0, -1).join(", ")} or ${ESTIMATE_MONTHS.at(-1)} months (${DEFAULT_ESTIMATE_MONTHS} by default); each car's entry carries its estimate. Give it ONLY as "an estimate at Autochek's published ceiling over N months — your offer sets the real rate and can be lower"; never as the lender's quote, never as "your repayment". The offer may also add ${MONTHLY_INCLUDES}.
- What Autochek asks for: a BVN, a valid ID, bank statements for the last ${DRIVE_PLAN.statementMonths} months from the account the buyer actually uses — a commercial bank, or ${DRIVE_PLAN.statementAlternative} — showing money coming in and going out (every applicant; the app is the alternative for those without a commercial bank account), proof of income (an employment letter or payslips for salary earners; a CAC business registration for business owners, and a registered business name is enough), and a utility bill. A business owner without a CAC registration can register a business name first, at pre.cac.gov.ng for the CAC's published fee (about ₦21,700 in 2026, usually within a few working days); Autochek's team told Sabicars in October 2026 that it can arrange one for about ₦35,000 (say it exactly that way — it is what its team said, not a published Autochek price).
- Fees: Autochek charges a processing fee (its published example is ${formatNaira(DRIVE_PLAN.published.processingFeeMinor)}), credited against the final payment if the loan goes through. The monthly repayment includes ${MONTHLY_INCLUDES}, as set out on the car's Autochek listing.
- Timing: Autochek says offers come within ${DRIVE_PLAN.published.offerWithin} of a complete application. The car leaves the showroom only once Autochek's lender approves AND the deposit is paid.
- How it works: /drive-plan. On each car's page there is a Drive Plan button.
- These rules — the deposit tiers, and that statements from ${DRIVE_PLAN.statementAlternative} count for a buyer without a commercial bank account — were given to Sabicars by Autochek's team on 20 October 2026; say so that way, never as something Autochek publishes. Autochek's lenders decide each application.

## Other ways Sabicars helps
- ${page("/find")}: a buyer describes a car that is not in stock — make, model, year, budget — gets a reference number, and is told the moment one arrives.
- ${page("/partners")}: anyone can register free, share their link, and earn 1.5% of the price when a buyer they sent completes a purchase.
- ${page("/fleet")}: companies and government offices buy several vehicles as one order, with one written quote.
- Price-drop alerts: on any car's page, a buyer can ask to be told if the price drops. ${page("/saved")}: tap the heart on any car to keep it there with today's price.
- ${page("/compare")}: any two or three cars side by side.

## The site's pages, by the names buyers see in the menus
${pageNames()}

## Useful links
- All stock: /vehicles · SUVs: /vehicles?body=suv · Buses: /vehicles?body=bus · Saloon cars: /vehicles?body=car · Pickups: /vehicles?body=pickup · Trucks: /vehicles?body=truck
- Luxury: /vehicles?segment=luxury · By price: /vehicles?maxPrice=20000000 (whole naira)
- The Hummer bus: /hummer-bus · Contact: /contact · About: /about · Answers to common questions: /ask

## The Hiace family: the old Hiace and Hummer 1, 2 and 3 (Sabicars' own definitions)
${familyGuide()}

## Articles on the site (link to them when they genuinely help)
${articles(posts)}
${published.length ? `\n## Answers Sabicars has published (answer consistently with these)\n${answers(published)}\n` : ""}
## The stock, cheapest first
${stockSummary(stock)}

${stock.map((v) => vehicleEntry(v, now, reports.get(v.id))).join("\n\n")}
`;
}

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
