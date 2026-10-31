/**
 * Database schema — Sabicars platform.
 *
 * Design notes that are easy to get wrong and expensive to fix later:
 *
 * 1. MONEY IS bigint KOBO, never integer or float.
 *    ₦38,000,000 is 3,800,000,000 kobo; Postgres `integer` stops at
 *    2,147,483,647, so an ordinary Prado would overflow it.
 *
 * 2. EVERY business row belongs to a dealer.
 *    There is exactly one dealer at launch — Sabicars. When other dealers join
 *    (architecture §7, phase 7) that becomes a permissions layer over data that
 *    is already partitioned, not a migration of live records.
 *
 * 3. A VEHICLE'S OWNER, KEEPER AND LOCATION ARE DIFFERENT THINGS.
 *    Trucks are owned by an importer in Japan, entrusted to Sabicars, and shown
 *    at another park. `owner_kind` + `consignor_id`, `custodian_staff_id` and
 *    `location_id` record each fact separately.
 *
 * 4. RULES LIVE IN THE DATABASE.
 *    The legacy admin stored "31,000,000Z" as a price and a gearbox as a
 *    drivetrain because every field was free text. Here, anything with a fixed
 *    vocabulary is an enum and anything with a sane range has a CHECK, so bad
 *    data is refused at the door rather than discovered on the website.
 *    scripts/verify-schema.mjs proves each rule against a real Postgres.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Block } from "../lib/blog/blocks";
import type { Items } from "../lib/inspection/checklist";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ── Enums ─────────────────────────────────────────────────────────────── */

export const dealerStatus = pgEnum("dealer_status", ["active", "suspended"]);

export const staffRole = pgEnum("staff_role", ["owner", "manager", "sales"]);

export const vehicleStatus = pgEnum("vehicle_status", [
  "draft", // being prepared, not public
  "available",
  "reserved", // deposit taken, held for a buyer
  "sold",
  "unlisted", // withdrawn but kept for the record
]);

/** Nigeria's own vocabulary, not the US "new / used / certified". */
export const vehicleCondition = pgEnum("vehicle_condition", [
  "foreign_used", // tokunbo
  "nigerian_used",
  "brand_new",
]);

export const vehicleBody = pgEnum("vehicle_body", [
  "sedan",
  "suv",
  "bus",
  "van",
  "pickup",
  "truck",
  "coupe",
  "hatchback",
  "wagon",
  "convertible",
  "other",
]);

/**
 * How the vehicle is sold, separately from its shape: a Hiace is a bus in the
 * commercial segment; a G-Wagon is an SUV in the luxury segment. The legacy
 * `category` field mixed the two ("luxury" and "suv" as siblings).
 */
export const vehicleSegment = pgEnum("vehicle_segment", ["standard", "luxury", "commercial"]);

export const fuelType = pgEnum("fuel_type", ["petrol", "diesel", "hybrid", "electric", "cng", "other"]);
export const transmissionType = pgEnum("transmission_type", ["automatic", "manual", "other"]);
export const drivetrainType = pgEnum("drivetrain_type", ["fwd", "rwd", "awd", "4wd"]);

/** A merchandising label, chosen by staff. "New arrival" is derived from dates, not stored. */
export const vehicleBadge = pgEnum("vehicle_badge", ["hot", "premium", "fleet_supply"]);

export const ownerKind = pgEnum("owner_kind", ["dealer", "consignor"]);
export const mediaKind = pgEnum("media_kind", ["photo", "video"]);

export const leadType = pgEnum("lead_type", [
  "question",
  "viewing",
  "reservation",
  "drive_plan",
  "fleet",
  "contact",
  /** A standing request for a vehicle not in stock (the Sourcing Desk). */
  "sourcing",
  /** Watching a vehicle for a price drop. */
  "watch",
  /** Someone offering their own car: to sell, trade in, or have sold for them (/sell). */
  "sell",
]);

export const leadChannel = pgEnum("lead_channel", [
  "web_form",
  "assistant",
  "phone",
  "walk_in",
  "whatsapp",
  "legacy_import",
]);

export const leadStatus = pgEnum("lead_status", ["new", "contacted", "qualified", "won", "lost"]);

export const requestPayment = pgEnum("request_payment", ["cash", "drive_plan", "undecided"]);
/**
 * open: waiting for review or a match · sourcing: staff judged the buyer
 * serious and are looking for the car · matched: a vehicle has been offered ·
 * fulfilled: they bought · closed: no longer active.
 */
export const requestStatus = pgEnum("request_status", ["open", "sourcing", "matched", "fulfilled", "closed"]);
export const matchStatus = pgEnum("match_status", ["pending", "sent", "failed", "dismissed"]);

export const partnerStatus = pgEnum("partner_status", ["active", "suspended"]);

/**
 * A commission's life: pending (earned, in its cooling-off, or waiting for a
 * payout) → paid, or void (the sale fell through before it was paid). Whether
 * a pending one is payable is a question of time — payableAt — not a state
 * machine step, so nothing has to run to "release" it.
 */
export const commissionStatus = pgEnum("commission_status", ["pending", "paid", "void"]);

/**
 * One attempt to pay a commission. pending: the row is written and the
 * transfer is about to be requested · processing: Paystack accepted it and
 * has not settled it yet · paid · failed (may be retried with a new row) ·
 * reversed (Paystack returned the money after a failed settlement).
 */
export const payoutStatus = pgEnum("payout_status", ["pending", "processing", "paid", "failed", "reversed"]);

export const leadActivityKind = pgEnum("lead_activity_kind", [
  "alerted", // staff were notified (detail: how many, which channels)
  "claimed", // a staff member took it
  "assigned", // given to someone by a manager
  "status", // detail: the new status
  "contacted", // detail: call | whatsapp | email
  "note",
  "escalated", // untouched too long: managers alerted
  "review_requested", // staff sent the buyer their private review link
  "reviewed", // the buyer left a review through it
]);

/* ── Dealers, locations, people ────────────────────────────────────────── */

export const dealers = pgTable("dealers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  /** CAC registration. */
  rcNumber: text("rc_number"),
  status: dealerStatus("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    name: text("name").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    state: text("state"),
    phone: text("phone"),
    /** [{ day: 1, open: "08:00", close: "19:00" }, …] */
    hours: jsonb("hours"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("locations_dealer_idx").on(t.dealerId)],
);

/** Someone whose vehicles we sell on their behalf — e.g. the truck importer. */
export const consignors = pgTable(
  "consignors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    country: text("country"),
    /** Sabicars' share of a sale, in basis points (1000 = 10%), if agreed as a percentage. */
    commissionBps: integer("commission_bps"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("consignors_dealer_idx").on(t.dealerId),
    check("consignors_commission_range", sql`${t.commissionBps} IS NULL OR ${t.commissionBps} BETWEEN 0 AND 10000`),
  ],
);

export const staff = pgTable(
  "staff",
  {
    /** Mirrors the Supabase auth user id. */
    id: uuid("id").primaryKey(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    email: text("email").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    role: staffRole("role").notNull().default("sales"),
    isActive: boolean("is_active").notNull().default(true),
    /** Whether new enquiries alert this person (push to their phone, and email). */
    receivesAlerts: boolean("receives_alerts").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("staff_email_idx").on(sql`lower(${t.email})`),
    index("staff_dealer_idx").on(t.dealerId),
  ],
);

/* ── Vehicles ──────────────────────────────────────────────────────────── */

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    /** Mongo _id from the legacy API, so the import can be re-run safely up to cutover. */
    legacyId: text("legacy_id"),

    ownerKind: ownerKind("owner_kind").notNull().default("dealer"),
    consignorId: uuid("consignor_id").references(() => consignors.id),
    custodianStaffId: uuid("custodian_staff_id").references(() => staff.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id),

    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    year: integer("year").notNull(),
    body: vehicleBody("body"),
    segment: vehicleSegment("segment").notNull().default("standard"),
    condition: vehicleCondition("condition").notNull(),

    chassisNo: text("chassis_no"),
    mileageKm: integer("mileage_km"),
    fuel: fuelType("fuel"),
    transmission: transmissionType("transmission"),
    /** The marketing name of the gearbox — "9G-TRONIC 9-speed" — kept apart from the type. */
    transmissionDetail: text("transmission_detail"),
    drivetrain: drivetrainType("drivetrain"),
    engine: text("engine"),
    horsepower: integer("horsepower"),
    exteriorColour: text("exterior_colour"),
    interiorColour: text("interior_colour"),
    seats: integer("seats"),

    /** Kobo. null means "price on request" — never a zero. */
    priceMinor: bigint("price_minor", { mode: "number" }),
    /** Strike-through price, for genuine reductions only. */
    wasPriceMinor: bigint("was_price_minor", { mode: "number" }),
    /**
     * Kobo: what the buyer actually paid, recorded when the car is sold. Never
     * shown on its own; it feeds the Sabicars Price Index, which publishes
     * averages only (architecture, stage 8).
     */
    soldPriceMinor: bigint("sold_price_minor", { mode: "number" }),

    /**
     * This vehicle on Sabicars' Autochek dealer store. Autochek profiles Drive
     * Plan buyers and finances the balance (60% of a car from 2010, 50% of a
     * 2008 or 2009 car, nothing older — lib/drive-plan.ts), but only for
     * vehicles listed there; its lender sets the rate and term. (Legacy field:
     * financeUrl.)
     */
    autochekUrl: text("autochek_url"),

    /**
     * True for a car Sabicars lists but does not hold at its showroom — a
     * partner's or an owner's car kept elsewhere. It is viewed and inspected
     * on a buyer's request and never carries the Sabicars Verified seal, which
     * is only given to cars the Sabicars team inspects at the showroom.
     */
    heldOffsite: boolean("held_offsite").notNull().default(false),

    status: vehicleStatus("status").notNull().default("draft"),
    badge: vehicleBadge("badge"),
    isFeatured: boolean("is_featured").notNull().default(false),
    inHero: boolean("in_hero").notNull().default(false),

    slug: text("slug").notNull(),
    headline: text("headline"),
    description: text("description"),
    features: jsonb("features").$type<string[]>().notNull().default([]),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("vehicles_dealer_slug_idx").on(t.dealerId, t.slug),
    check("vehicles_autochek_https", sql`${t.autochekUrl} IS NULL OR ${t.autochekUrl} LIKE 'https://%'`),
    uniqueIndex("vehicles_legacy_idx").on(t.legacyId),
    index("vehicles_dealer_status_idx").on(t.dealerId, t.status),
    index("vehicles_make_model_idx").on(t.make, t.model),
    index("vehicles_price_idx").on(t.priceMinor),
    check("vehicles_year_range", sql`${t.year} BETWEEN 1950 AND 2100`),
    check("vehicles_price_positive", sql`${t.priceMinor} IS NULL OR ${t.priceMinor} > 0`),
    check("vehicles_was_price_higher", sql`${t.wasPriceMinor} IS NULL OR (${t.priceMinor} IS NOT NULL AND ${t.wasPriceMinor} > ${t.priceMinor})`),
    check("vehicles_mileage_range", sql`${t.mileageKm} IS NULL OR ${t.mileageKm} BETWEEN 0 AND 2000000`),
    check("vehicles_seats_range", sql`${t.seats} IS NULL OR ${t.seats} BETWEEN 1 AND 80`),
    check("vehicles_horsepower_range", sql`${t.horsepower} IS NULL OR ${t.horsepower} BETWEEN 20 AND 2500`),
    check("vehicles_consignor_matches_owner", sql`(${t.ownerKind} = 'consignor') = (${t.consignorId} IS NOT NULL)`),
    check("vehicles_sold_has_date", sql`${t.status} <> 'sold' OR ${t.soldAt} IS NOT NULL`),
    check("vehicles_sold_price_positive", sql`${t.soldPriceMinor} IS NULL OR ${t.soldPriceMinor} > 0`),
    check("vehicles_sold_price_only_when_sold", sql`${t.soldPriceMinor} IS NULL OR ${t.status} = 'sold'`),
    check("vehicles_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export const vehicleMedia = pgTable(
  "vehicle_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull().default("photo"),
    /** Delivery URL (Cloudinary secure_url, or a YouTube link for kind = video). */
    url: text("url").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id"),
    /** 0 is the cover image. */
    position: integer("position").notNull(),
    alt: text("alt"),
    width: integer("width"),
    height: integer("height"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("vehicle_media_position_idx").on(t.vehicleId, t.position),
    check("vehicle_media_position_nonnegative", sql`${t.position} >= 0`),
    check("vehicle_media_https", sql`${t.url} ~ '^https://'`),
  ],
);

/* ── Sabicars Verified ─────────────────────────────────────────────────── */

/** draft → published; publishing a newer report supersedes the old one; withdrawn takes one down. */
export const inspectionStatus = pgEnum("inspection_status", ["draft", "published", "superseded", "withdrawn"]);

/** What a history report (Carfax, an auction sheet…) says about the title. */
export const historyTitle = pgEnum("history_title", ["clean", "salvage", "rebuilt", "flood", "other", "no_record"]);

/**
 * An inspection report: the evidence behind the Sabicars Verified seal.
 *
 * Each check's result lives in `items`, keyed by the stable keys in
 * lib/inspection/checklist.ts, so the list of checks can grow without a
 * migration. The rules that make a report publishable (every check answered,
 * every problem with a note and a photo) are enforced when publishing; the
 * database guards what must never be missing from a published report.
 */
export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    /** On the windscreen seal and in the address: /v/7K3P9Q. */
    code: text("code").notNull(),
    status: inspectionStatus("status").notNull().default("draft"),

    inspectedAt: timestamp("inspected_at", { withTimezone: true }),
    /** The person who did the inspection, who may be a mechanic rather than staff. */
    inspectorName: text("inspector_name"),
    odometerKm: integer("odometer_km"),
    /** Read off the car during the inspection; shown in public with the last four characters hidden. */
    vin: text("vin"),
    /** The inspector's own summary, shown above the checks. */
    summary: text("summary"),
    items: jsonb("items").$type<Items>().notNull().default({}),

    historySource: text("history_source"),
    historyCheckedAt: timestamp("history_checked_at", { withTimezone: true }),
    historyTitle: historyTitle("history_title"),
    historyAccidents: integer("history_accidents"),
    historyLastOdometerKm: integer("history_last_odometer_km"),
    historyNotes: text("history_notes"),

    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    publishedBy: uuid("published_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("inspections_code_idx").on(t.code),
    /** One live report per car: publishing a new one supersedes the old in the same transaction. */
    uniqueIndex("inspections_one_published_idx").on(t.vehicleId).where(sql`${t.status} = 'published'`),
    index("inspections_vehicle_idx").on(t.vehicleId, t.createdAt),
    check("inspections_code_format", sql`${t.code} ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'`),
    check("inspections_odometer_range", sql`${t.odometerKm} IS NULL OR ${t.odometerKm} BETWEEN 0 AND 2000000`),
    check("inspections_history_odometer_range", sql`${t.historyLastOdometerKm} IS NULL OR ${t.historyLastOdometerKm} BETWEEN 0 AND 2000000`),
    check("inspections_history_accidents_range", sql`${t.historyAccidents} IS NULL OR ${t.historyAccidents} BETWEEN 0 AND 50`),
    check(
      "inspections_published_complete",
      sql`${t.status} IN ('draft', 'withdrawn') OR (${t.inspectedAt} IS NOT NULL AND ${t.inspectorName} IS NOT NULL AND length(btrim(${t.inspectorName})) > 0 AND ${t.odometerKm} IS NOT NULL AND ${t.publishedAt} IS NOT NULL)`,
    ),
  ],
);

/* ── Leads ─────────────────────────────────────────────────────────────── */

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    legacyId: text("legacy_id"),
    type: leadType("type").notNull(),
    channel: leadChannel("channel").notNull(),
    status: leadStatus("status").notNull().default("new"),

    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),

    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    message: text("message"),
    /** phone | whatsapp | email */
    preferredContact: text("preferred_contact"),
    /** The slot a viewing was booked for (lib/viewings.ts). Only a viewing has one. */
    viewingAt: timestamp("viewing_at", { withTimezone: true }),
    /** When the buyer was reminded on the morning of the viewing, so a re-run never reminds twice. */
    viewingRemindedAt: timestamp("viewing_reminded_at", { withTimezone: true }),

    /** Attribution: which page, campaign or partner produced the lead. */
    landingPath: text("landing_path"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    /** The Refer & Earn partner whose link brought this buyer — the record their commission rests on. */
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),

    assignedTo: uuid("assigned_to").references(() => staff.id, { onDelete: "set null" }),
    /**
     * Response time predicts close rate better than almost anything else in
     * car sales, so it is measured rather than hoped for.
     */
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    /** Set when an untouched lead was escalated to managers, so it escalates once. */
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    /**
     * Issued when the lead becomes a sale: the buyer's private link to review
     * the purchase. A review left through it is marked "Verified buyer",
     * because it is tied to a sale on record — the only kind of verification
     * a review page can honestly claim.
     */
    reviewToken: uuid("review_token"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("leads_legacy_idx").on(t.legacyId),
    uniqueIndex("leads_review_token_idx").on(t.reviewToken),
    index("leads_dealer_status_idx").on(t.dealerId, t.status, t.createdAt),
    index("leads_assigned_idx").on(t.assignedTo, t.status),
    check("leads_reachable", sql`${t.phone} IS NOT NULL OR ${t.email} IS NOT NULL`),
    check("leads_name_present", sql`length(btrim(${t.name})) > 0`),
    /** Counting bookings per slot, and the morning's list of viewings. */
    index("leads_viewing_idx").on(t.dealerId, t.viewingAt),
    check("leads_viewing_time_only_on_viewings", sql`${t.viewingAt} IS NULL OR ${t.type} = 'viewing'`),
  ],
);

/**
 * The Sourcing Desk. Sabicars' audience is larger than its showroom, so a
 * buyer whose car is not in stock leaves a standing request instead of
 * leaving. Each request is a lead (one inbox, one reference) plus the
 * criteria new stock is matched against; together they tell staff what to
 * source, and tell the buyer the moment a match arrives.
 */
export const vehicleRequests = pgTable(
  "vehicle_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    /** In the buyer's words — "Toyota Highlander", "Hiace high roof". Matched against make and model. */
    want: text("want").notNull(),
    yearFrom: integer("year_from"),
    /** Most they will pay for the vehicle, in kobo. Null: not stated. */
    budgetMaxMinor: bigint("budget_max_minor", { mode: "number" }),
    payment: requestPayment("payment").notNull().default("undecided"),
    status: requestStatus("status").notNull().default("open"),
    /** When stock matching this request was last offered to the buyer. */
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    /** What staff made of the request and the buyer — how serious, what was tried. */
    staffNote: text("staff_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("vehicle_requests_lead_idx").on(t.leadId),
    index("vehicle_requests_open_idx").on(t.dealerId, t.status, t.createdAt),
    check("vehicle_requests_want_present", sql`length(btrim(${t.want})) > 1`),
    check("vehicle_requests_year_range", sql`${t.yearFrom} IS NULL OR ${t.yearFrom} BETWEEN 1980 AND 2100`),
    check("vehicle_requests_budget_positive", sql`${t.budgetMaxMinor} IS NULL OR ${t.budgetMaxMinor} > 0`),
  ],
);

/**
 * Every vehicle offered against a request, and whether the buyer was told.
 * One row per (request, vehicle): a car is offered to a buyer once, however
 * many times it is saved or re-priced. "pending" means no automatic channel
 * could reach the buyer, so it waits on the staff board.
 */
export const requestMatches = pgTable(
  "request_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => vehicleRequests.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    status: matchStatus("status").notNull().default("pending"),
    /** email | whatsapp | sms | on_screen (shown when they asked) | staff (sent by a person) */
    channel: text("channel"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("request_matches_pair_idx").on(t.requestId, t.vehicleId),
    index("request_matches_status_idx").on(t.status, t.createdAt),
    check("request_matches_sent_has_date", sql`${t.status} <> 'sent' OR ${t.sentAt} IS NOT NULL`),
  ],
);

/**
 * A buyer watching a vehicle for a price drop — from their saved cars or the
 * vehicle's page. The watch is a lead (one inbox, one reference) tied to the
 * car; when staff cut the price below what the buyer last saw, the engine
 * tells them, and anything it cannot send waits on the staff board.
 */
export const vehicleWatches = pgTable(
  "vehicle_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    /** The price the buyer last knew about, in kobo: when they started watching, then each price they were told. */
    knownPriceMinor: bigint("known_price_minor", { mode: "number" }),
    /** A lower price waiting to be announced, and how that went. */
    pendingPriceMinor: bigint("pending_price_minor", { mode: "number" }),
    alertStatus: matchStatus("alert_status"),
    alertChannel: text("alert_channel"),
    alertedAt: timestamp("alerted_at", { withTimezone: true }),
    alertError: text("alert_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("vehicle_watches_lead_vehicle_idx").on(t.leadId, t.vehicleId),
    index("vehicle_watches_vehicle_idx").on(t.vehicleId),
    check("vehicle_watches_sent_has_date", sql`${t.alertStatus} IS DISTINCT FROM 'sent' OR ${t.alertedAt} IS NOT NULL`),
  ],
);

/**
 * Everything that happened to a lead, in order: who was alerted, who took it,
 * every call and message, every change and note. The lead's history belongs
 * to the business, not to one person's phone.
 */
export const leadActivity = pgTable(
  "lead_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    /** Null for what the system did (alerts, escalations). */
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    kind: leadActivityKind("kind").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("lead_activity_lead_idx").on(t.leadId, t.createdAt)],
);

/** A staff member's phone or browser, subscribed to push alerts (Web Push; no third-party service). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint),
    index("push_subscriptions_staff_idx").on(t.staffId),
    check("push_subscriptions_https", sql`${t.endpoint} LIKE 'https://%'`),
  ],
);

/* ── Refer & Earn ──────────────────────────────────────────────────────── */

/**
 * People who send Sabicars buyers for a 1.5% commission. The programme pays
 * only on completed sales and never for signing up other partners, so it
 * cannot become a pyramid. The code is how a referral is attributed: a buyer
 * who arrives through a partner's link is recorded against them, and nobody
 * else can claim that buyer.
 */
export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    /** Six characters, e.g. ADA7K3 — short enough to say out loud. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** E.164. One registration per phone number. */
    phone: text("phone").notNull(),
    email: text("email"),
    /** Where they expect to find buyers — tells Sabicars which channels work. */
    reach: text("reach"),
    status: partnerStatus("status").notNull().default("active"),

    /**
     * The partner's private key to their own page (/partner/TOKEN): earnings,
     * enquiries and the bank account they are paid into. Partners have no
     * login; this link is theirs alone, like a buyer's review link.
     */
    accessToken: uuid("access_token").notNull().defaultRandom(),

    /**
     * The one bank account a partner is paid into, which must be in their own
     * name. accountName is what the bank returns for the number (NIBSS, via
     * Paystack "resolve account"); accountVerifiedAt is set when that name
     * matches the partner's, or when a manager confirms it by hand. Changing
     * the account clears the verification and the Paystack recipient.
     */
    bankCode: text("bank_code"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    accountName: text("account_name"),
    accountVerifiedAt: timestamp("account_verified_at", { withTimezone: true }),
    /** Null when the name matched automatically; the manager who confirmed it otherwise. */
    accountVerifiedBy: uuid("account_verified_by").references(() => staff.id, { onDelete: "set null" }),
    /** Paystack's handle for this account (RCP_…), created once the account is verified. */
    paystackRecipientCode: text("paystack_recipient_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("partners_code_idx").on(t.code),
    uniqueIndex("partners_dealer_phone_idx").on(t.dealerId, t.phone),
    uniqueIndex("partners_access_token_idx").on(t.accessToken),
    uniqueIndex("partners_recipient_idx").on(t.paystackRecipientCode).where(sql`${t.paystackRecipientCode} IS NOT NULL`),
    check("partners_code_format", sql`${t.code} ~ '^[A-Z0-9]{6}$'`),
    check("partners_phone_e164", sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check("partners_name_present", sql`length(btrim(${t.name})) > 0`),
    /** A Nigerian account number (NUBAN) is exactly ten digits. */
    check("partners_account_nuban", sql`${t.accountNumber} IS NULL OR ${t.accountNumber} ~ '^[0-9]{10}$'`),
    /** The bank details come as a set: a number without its bank, or a verification without a number, is a bug. */
    check(
      "partners_account_complete",
      sql`(${t.accountNumber} IS NULL AND ${t.bankCode} IS NULL AND ${t.accountVerifiedAt} IS NULL AND ${t.paystackRecipientCode} IS NULL) OR (${t.accountNumber} IS NOT NULL AND ${t.bankCode} IS NOT NULL AND ${t.bankName} IS NOT NULL)`,
    ),
    check("partners_recipient_needs_verification", sql`${t.paystackRecipientCode} IS NULL OR ${t.accountVerifiedAt} IS NOT NULL`),
  ],
);

/* ── Refer & Earn: the commission ledger ───────────────────────────────── */

/**
 * One commission per sold vehicle: 1.5% of what it actually sold for, owed
 * to the partner whose link (or code, given at the showroom) brought the
 * buyer. The amount is frozen here at the sale, so a later change to the
 * rate or the price never moves what was owed. It waits out a cooling-off,
 * then is paid — once — and the payout that paid it is on record beside it.
 */
export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    partnerId: uuid("partner_id").notNull().references(() => partners.id),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
    /** The enquiry that carried the attribution, when there was one. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** link: the buyer arrived through the partner's link · manual: staff attributed a showroom sale to a code. */
    source: text("source").notNull(),
    /** What the vehicle sold for, in kobo — the base of the commission. */
    salePriceMinor: bigint("sale_price_minor", { mode: "number" }).notNull(),
    /** The rate applied, in basis points, kept with the row. */
    rateBps: integer("rate_bps").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    status: commissionStatus("status").notNull().default("pending"),
    /** When the sale was recorded. */
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull(),
    /** earnedAt plus the cooling-off; nothing is paid before it. */
    payableAt: timestamp("payable_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    /** One vehicle pays one commission; a voided one steps aside so a later, real sale can pay. */
    uniqueIndex("commissions_one_per_vehicle_idx").on(t.vehicleId).where(sql`${t.status} <> 'void'`),
    index("commissions_partner_idx").on(t.partnerId, t.createdAt),
    index("commissions_dealer_status_idx").on(t.dealerId, t.status, t.payableAt),
    check("commissions_source", sql`${t.source} IN ('link', 'manual')`),
    check("commissions_sale_positive", sql`${t.salePriceMinor} > 0`),
    check("commissions_amount_positive", sql`${t.amountMinor} > 0`),
    check("commissions_rate_range", sql`${t.rateBps} BETWEEN 1 AND 2000`),
    check("commissions_cooling_off", sql`${t.payableAt} >= ${t.earnedAt}`),
    check("commissions_paid_has_date", sql`${t.status} <> 'paid' OR ${t.paidAt} IS NOT NULL`),
    check("commissions_void_has_reason", sql`${t.status} <> 'void' OR (${t.voidedAt} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`),
  ],
);

export const reservationStatus = pgEnum("reservation_status", ["pending", "held", "expired", "completed", "refunded", "cancelled"]);

/**
 * A car reserved with a deposit (lib/reservations.ts holds the policy):
 * ₦500,000 holds it a week, 40% or more a month, a refund costs 18%. One
 * live row per car — pending or held — so two buyers can never both be
 * holding it, online or in the showroom. The reference is ours (`scr_…`) and
 * is also what Paystack is given, so a payment can be matched to its row.
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
    /** The enquiry row the reservation created, so it sits in the one inbox. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    buyerEmail: text("buyer_email"),
    /** The deposit, in kobo. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    /** The car's price when the deposit was taken, so the 40% rule is judged against what the buyer saw. */
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    holdDays: integer("hold_days").notNull(),
    status: reservationStatus("status").notNull().default("pending"),
    /** Ours, and Paystack's: `scr_` plus random letters. */
    reference: text("reference").notNull(),
    /** online: paid through Paystack · showroom: a deposit taken by staff and recorded here. */
    source: text("source").notNull().default("online"),
    /** card · bank_transfer · ussd · cash · bank (showroom). */
    channel: text("channel"),
    /** Paystack's fee on the payment, in kobo, when known. */
    feeMinor: bigint("fee_minor", { mode: "number" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    holdsUntil: timestamp("holds_until", { withTimezone: true }),
    refundMinor: bigint("refund_minor", { mode: "number" }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    /** When a hold ended or was cancelled, so the car went back on offer. */
    releasedAt: timestamp("released_at", { withTimezone: true }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reservations_reference_idx").on(t.reference),
    /** One buyer holds a car at a time; a finished reservation steps aside for the next. */
    uniqueIndex("reservations_one_per_vehicle_idx").on(t.vehicleId).where(sql`${t.status} IN ('pending', 'held')`),
    index("reservations_dealer_status_idx").on(t.dealerId, t.status, t.createdAt),
    check("reservations_source", sql`${t.source} IN ('online', 'showroom')`),
    check("reservations_amount_positive", sql`${t.amountMinor} > 0`),
    check("reservations_amount_within_price", sql`${t.amountMinor} <= ${t.priceMinor}`),
    check("reservations_hold_days", sql`${t.holdDays} BETWEEN 1 AND 31`),
    check("reservations_held_has_dates", sql`${t.status} NOT IN ('held', 'completed', 'expired', 'refunded') OR (${t.paidAt} IS NOT NULL AND ${t.holdsUntil} IS NOT NULL)`),
    check("reservations_refund_has_amount", sql`${t.status} <> 'refunded' OR (${t.refundedAt} IS NOT NULL AND ${t.refundMinor} IS NOT NULL)`),
  ],
);

export type Reservation = typeof reservations.$inferSelect;

/**
 * Every attempt to pay a commission, by Paystack transfer or by a bank
 * transfer made outside the platform and recorded here. The reference is
 * generated before Paystack is called and sent to it as the idempotency key,
 * so a retried request can never pay twice; a webhook or a verify call that
 * arrives later finds its row by that reference.
 */
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    commissionId: uuid("commission_id").notNull().references(() => commissions.id),
    partnerId: uuid("partner_id").notNull().references(() => partners.id),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    /** paystack: a transfer from Sabicars' Paystack balance · bank_transfer: paid from the bank and recorded here. */
    method: text("method").notNull(),
    status: payoutStatus("status").notNull().default("pending"),
    /** Ours, unique, made before anything is sent: scp_<commission>_<random>. */
    reference: text("reference").notNull(),
    /** Paystack's TRF_… code once it accepts the transfer. */
    transferCode: text("transfer_code"),
    /** Paystack's fee on the transfer, in kobo, for the books. */
    feeMinor: bigint("fee_minor", { mode: "number" }),
    /** For a bank transfer recorded by hand: the bank's reference or teller number. */
    bankReference: text("bank_reference"),
    /** The bank account the money went to, as it was at the time, so a later change to the partner's account does not rewrite history. */
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    accountName: text("account_name"),
    failureReason: text("failure_reason"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** The staff member who sent or recorded it. */
    recordedBy: uuid("recorded_by").references(() => staff.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payouts_reference_idx").on(t.reference),
    uniqueIndex("payouts_transfer_code_idx").on(t.transferCode).where(sql`${t.transferCode} IS NOT NULL`),
    /** One live payout per commission; a failed or reversed one may be retried with a new row. */
    uniqueIndex("payouts_one_live_per_commission_idx").on(t.commissionId).where(sql`${t.status} IN ('pending', 'processing', 'paid')`),
    index("payouts_partner_idx").on(t.partnerId, t.createdAt),
    check("payouts_method", sql`${t.method} IN ('paystack', 'bank_transfer')`),
    check("payouts_amount_positive", sql`${t.amountMinor} > 0`),
    check("payouts_reference_format", sql`${t.reference} ~ '^scp_[a-z0-9]{8}_[a-z0-9]{8}$'`),
    check("payouts_paid_has_date", sql`${t.status} <> 'paid' OR ${t.paidAt} IS NOT NULL`),
    check("payouts_manual_has_bank_reference", sql`${t.method} <> 'bank_transfer' OR ${t.bankReference} IS NOT NULL`),
    check("payouts_failed_has_reason", sql`${t.status} NOT IN ('failed', 'reversed') OR ${t.failureReason} IS NOT NULL`),
  ],
);

/* ── Content and audience (carried over from the legacy API) ───────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    legacyId: text("legacy_id"),
    name: text("name").notNull(),
    location: text("location"),
    rating: integer("rating").notNull(),
    message: text("message").notNull(),
    /**
     * The legacy API published reviews the moment they were posted. Here a
     * review waits for a person — an institution does not let strangers write
     * on its front page unread. Approval is for spam and abuse, not for
     * rating: a genuine critical review is published like any other.
     */
    isApproved: boolean("is_approved").notNull().default(false),
    /** When staff published or hid it. Null: still waiting to be read. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => staff.id, { onDelete: "set null" }),
    /** Set only for reviews left through a buyer's private link: a verified buyer. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** The vehicle a verified buyer bought. */
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /** Hashed, for rate limiting anonymous submissions; never the address itself. */
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_legacy_idx").on(t.legacyId),
    // One review per sale.
    uniqueIndex("reviews_lead_idx").on(t.leadId),
    index("reviews_published_idx").on(t.dealerId, t.isApproved, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
    check("reviews_message_present", sql`length(btrim(${t.message})) > 0`),
  ],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    legacyId: text("legacy_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    excerpt: text("excerpt").notNull(),
    /** The line under the headline: the hook that makes the first paragraph get read. */
    standfirst: text("standfirst"),
    /**
     * HTML from the legacy editor, kept as the source of old posts. Never
     * rendered: it is converted to blocks (lib/blog/from-html.ts).
     */
    content: text("content").notNull().default(""),
    /** The article itself, as blocks (lib/blog/blocks.ts). */
    blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
    coverImageUrl: text("cover_image_url"),
    /** A silent looping clip in place of the cover photo, where one exists. */
    coverVideoUrl: text("cover_video_url"),
    /** Search terms it is about ("toyota-hiace-hummer") — links it to the matching cars and landing pages. */
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isFeatured: boolean("is_featured").notNull().default(false),
    /** When subscribers and the bell were told about it — once. */
    announcedAt: timestamp("announced_at", { withTimezone: true }),
    author: text("author").notNull().default("Sabicars Team"),
    readMinutes: integer("read_minutes"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    views: integer("views").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    /** { like, fire, love, insightful } */
    reactions: jsonb("reactions").$type<Record<string, number>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("blog_posts_dealer_slug_idx").on(t.dealerId, t.slug),
    uniqueIndex("blog_posts_legacy_idx").on(t.legacyId),
    check("blog_posts_published_has_date", sql`NOT ${t.isPublished} OR ${t.publishedAt} IS NOT NULL`),
  ],
);

export const blogComments = pgTable(
  "blog_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
    legacyId: text("legacy_id"),
    name: text("name").notNull(),
    message: text("message").notNull(),
    isApproved: boolean("is_approved").notNull().default(false),
    /** When staff published or hid it. Null: still waiting to be read. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("blog_comments_legacy_idx").on(t.legacyId), index("blog_comments_post_idx").on(t.postId, t.isApproved)],
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    legacyId: text("legacy_id"),
    email: text("email").notNull(),
    name: text("name"),
    topics: jsonb("topics").$type<string[]>().notNull().default(["cars", "blog", "offers"]),
    isActive: boolean("is_active").notNull().default(true),
    /** Opaque token for the one-click unsubscribe link every broadcast must carry. */
    unsubscribeToken: uuid("unsubscribe_token").notNull().defaultRandom(),
    /** Where they signed up: prompt | footer | article | legacy — tells Sabicars which asks work. */
    source: text("source"),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("subscribers_dealer_email_idx").on(t.dealerId, sql`lower(${t.email})`),
    uniqueIndex("subscribers_legacy_idx").on(t.legacyId),
    uniqueIndex("subscribers_token_idx").on(t.unsubscribeToken),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    legacyId: text("legacy_id"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    /** arrival | price_drop | blog | offer | system (car: legacy "new arrival" posts) */
    kind: text("kind").notNull().default("system"),
    link: text("link"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /** Large image shown with the push and in the feed. */
    imageUrl: text("image_url"),
    /**
     * What caused an automatic notification — "arrival:<vehicle>",
     * "price:<vehicle>:<kobo>". Unique, so a car is announced once and a
     * given price cut once, however many times staff press save.
     */
    eventKey: text("event_key"),
    /** Who posted it by hand; null when the platform posted it. */
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    pushRecipients: integer("push_recipients"),
    pushError: text("push_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notifications_legacy_idx").on(t.legacyId),
    uniqueIndex("notifications_event_idx").on(t.dealerId, t.eventKey),
    index("notifications_recent_idx").on(t.dealerId, t.createdAt),
    index("notifications_vehicle_idx").on(t.vehicleId),
  ],
);

/**
 * Every newsletter email sent to subscribers: the weekly arrivals digest,
 * new-article announcements and staff broadcasts. `periodKey` makes the
 * automatic ones idempotent — a week's digest goes out once.
 */
export const newsletterSends = pgTable(
  "newsletter_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    /** digest | article | broadcast */
    kind: text("kind").notNull(),
    periodKey: text("period_key"),
    subject: text("subject").notNull(),
    /** What staff wrote, for a broadcast. */
    body: text("body"),
    vehicleIds: jsonb("vehicle_ids").$type<string[]>().notNull().default([]),
    /** sending | sent | failed | skipped */
    status: text("status").notNull().default("sending"),
    recipients: integer("recipients").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    error: text("error"),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("newsletter_sends_period_idx").on(t.dealerId, t.periodKey),
    index("newsletter_sends_recent_idx").on(t.dealerId, t.createdAt),
    check("newsletter_sends_kind", sql`${t.kind} IN ('digest', 'article', 'broadcast')`),
    check("newsletter_sends_status", sql`${t.status} IN ('sending', 'sent', 'failed', 'skipped')`),
  ],
);

/** Small key/value settings owned by staff (e.g. the hero video). */
export const settings = pgTable(
  "settings",
  {
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    key: text("key").notNull(),
    value: jsonb("value"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("settings_dealer_key_idx").on(t.dealerId, t.key)],
);

/* ── Ask Sabicars: the website assistant ───────────────────────────────── */

/**
 * A conversation with Ask Sabicars. Every one is kept, not only those that
 * became an enquiry: what people ask at 2am, when nobody is on the phone, is
 * the most honest market research the business has — and a chat that ended
 * without a lead usually means the car they wanted was not in stock.
 */
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    /** Where it started, so the context is not lost. */
    landingPath: text("landing_path"),
    /** The vehicle page it started on, if it started on one. */
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    /** Written by a model for staff, so they read a paragraph rather than a transcript. */
    summary: text("summary"),
    intent: text("intent"),
    summarisedAt: timestamp("summarised_at", { withTimezone: true }),
    /** Set once contact details were given: the conversation joins the one inbox. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    /** The visitor asked for a person, or the assistant reached the edge of what it may say. */
    needsHuman: boolean("needs_human").notNull().default(false),
    /** Counted rather than derived, so a long chat cannot be extended by deleting rows. */
    messageCount: integer("message_count").notNull().default(0),
    /** Slugs of every vehicle the assistant put in front of the visitor. */
    vehiclesShown: jsonb("vehicles_shown").$type<string[]>().notNull().default([]),
    /** Hashed, never stored raw: enough to rate-limit, not enough to locate anyone. */
    ipHash: text("ip_hash"),
    /**
     * A random id in a cookie on the visitor's own device, so the assistant
     * recognises them when they come back — and only there, where only they
     * can be. Never a phone number: anyone can type someone else's.
     */
    deviceId: text("device_id"),
    /**
     * "assistant": the buyer talks to Sabi. "seller": the buyer asked for the
     * team — people reply from the admin, and Sabi steps in only when nobody is
     * free within the typical wait (lib/assistant/seller.ts).
     */
    mode: text("mode").notNull().default("assistant"),
    /** A buyer's message in a seller chat is waiting for a person since then; null once someone (or Sabi) answered. */
    awaitingSince: timestamp("awaiting_since", { withTimezone: true }),
    /** The last time a member of staff wrote in the chat: a person is "in the room" for a few minutes after. */
    lastStaffAt: timestamp("last_staff_at", { withTimezone: true }),
    /** When staff phones were last pinged about this chat, so a quick typist does not ring them every line. */
    staffAlertedAt: timestamp("staff_alerted_at", { withTimezone: true }),
    createdAt: createdAt(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assistant_conversations_recent_idx").on(t.dealerId, t.lastMessageAt),
    index("assistant_conversations_ip_idx").on(t.ipHash, t.lastMessageAt),
    index("assistant_conversations_device_idx").on(t.deviceId, t.lastMessageAt).where(sql`${t.deviceId} IS NOT NULL`),
    index("assistant_conversations_awaiting_idx").on(t.dealerId, t.awaitingSince).where(sql`${t.awaitingSince} IS NOT NULL`),
    check("assistant_conversations_mode", sql`${t.mode} IN ('assistant', 'seller')`),
  ],
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    /** user (the buyer), assistant (Sabi), or staff (a person on the team, in a seller chat). */
    role: text("role").notNull(),
    /** As the model wrote it, directives included, so it sees what it showed. */
    content: text("content").notNull(),
    /** Who on the team wrote a staff message, so the buyer sees a name. */
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("assistant_messages_conversation_idx").on(t.conversationId, t.createdAt),
    check("assistant_messages_role", sql`${t.role} IN ('user', 'assistant', 'staff')`),
  ],
);

/**
 * Questions buyers ask, answered in public at /ask. Search engines cannot talk
 * to a chat window, so the best answers leave it: staff publish them from real
 * conversations, and each becomes a page Google can index — and the assistant
 * reads them back, so it answers the same way.
 */
/** What the assistant learns each week: a model's reading of the week's chats, for the owner to turn into published answers. */
export interface AssistantReport {
  /** What buyers asked most, as a buyer would phrase it, with how many asked. */
  topQuestions: { question: string; count: number }[];
  /** Questions the assistant could not answer, each with a draft answer for a manager to check and publish. */
  unanswered: { question: string; draftAnswer: string; timesAsked: number }[];
  /** Cars people wanted that were not in stock. */
  wantedNotInStock: { car: string; count: number }[];
  /** Replies or site words that lost people, and what to say instead. */
  confusing: { what: string; instead: string }[];
  /** Anything else worth the owner's minute. */
  notes: string[];
}

export const assistantReviews = pgTable(
  "assistant_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    conversations: integer("conversations").notNull().default(0),
    report: jsonb("report").$type<AssistantReport>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("assistant_reviews_recent_idx").on(t.dealerId, t.createdAt)],
);

export const askAnswers = pgTable(
  "ask_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").notNull().references(() => dealers.id),
    slug: text("slug").notNull(),
    question: text("question").notNull(),
    /** Plain text with the blog's safe inline syntax: **bold**, *italic*, [link](/path). */
    answer: text("answer").notNull(),
    /** The chat it was drawn from, when it was drawn from one. */
    conversationId: uuid("conversation_id").references(() => assistantConversations.id, { onDelete: "set null" }),
    isPublished: boolean("is_published").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ask_answers_slug_idx").on(t.dealerId, t.slug),
    index("ask_answers_published_idx").on(t.dealerId, t.isPublished, t.position),
    check("ask_answers_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("ask_answers_question_present", sql`length(btrim(${t.question})) > 0`),
  ],
);

/* ── Accountability ────────────────────────────────────────────────────── */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: uuid("dealer_id").references(() => dealers.id),
    actorId: uuid("actor_id"),
    actorEmail: text("actor_email"),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    /** create | update | delete | status_change | import */
    action: text("action").notNull(),
    diff: jsonb("diff"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_at_idx").on(t.at)],
);

/* ── Operations: errors the site saw ───────────────────────────────────── */

/**
 * One row per distinct error, counted, so a failure at 2 a.m. is on record
 * and the managers were told, rather than waiting for a customer to
 * complain. The fingerprint groups repeats of the same error; the message
 * and stack are stored redacted (no account numbers, phones or emails).
 */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** sha256 of kind, message and the first stack frame: the same error again lands on the same row. */
    fingerprint: text("fingerprint").notNull(),
    /** server: thrown while rendering or in an action · client: caught by the browser's error boundary · check: a deploy check or monitor reported it. */
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    /** The page or route it happened on, and how it was reached. */
    path: text("path"),
    method: text("method"),
    /** Next.js's own digest for the error, when it gives one. */
    digest: text("digest"),
    count: integer("count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the managers were last told about this one; alerts are throttled per fingerprint. */
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => staff.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("incidents_fingerprint_idx").on(t.fingerprint),
    index("incidents_last_seen_idx").on(t.lastSeenAt),
    check("incidents_kind", sql`${t.kind} IN ('server', 'client', 'check')`),
    check("incidents_count_positive", sql`${t.count} >= 1`),
  ],
);

/* ── Operations: throttles and the email outbox ───────────────────────── */

/**
 * How many times one address has used one public form in the current
 * window. One row per (bucket, address, window), counted up in a single
 * upsert, so every server instance shares the same count. The address is
 * stored as a hash, never as an IP. Old windows are swept away
 * (lib/rate-limit.ts).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    /** sha256 of the client address, first 32 hex characters. */
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.keyHash, t.windowStart] }),
    index("rate_limits_window_idx").on(t.windowStart),
    check("rate_limits_count_positive", sql`${t.count} >= 1`),
    check("rate_limits_key_hash_format", sql`${t.keyHash} ~ '^[0-9a-f]{32}$'`),
  ],
);

/**
 * Every transactional email, written down before it is sent. A burst —
 * thousands of partner welcomes in an hour — is sent at the provider's pace
 * from here instead of being refused and lost; a failed send is retried with
 * a growing wait; an email still unsent after a day is marked expired rather
 * than delivered late. The newsletter keeps its own record (newsletter_sends)
 * and does not pass through here.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    textBody: text("text_body").notNull(),
    replyTo: text("reply_to"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    /** Optional: the same key twice means the same email, sent once (e.g. "welcome:<partner id>"). */
    dedupeKey: text("dedupe_key"),
    /** pending: waiting for its turn · sending: claimed by a sender right now · sent · failed: refused for good · expired: never sent within a day. */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    /** When a sender claimed it, so a sender that died mid-send releases it after a few minutes. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /**
     * The batch this email was first sent in. Kept until the batch's outcome is
     * known, so a batch whose reply never arrived is retried as exactly the same
     * set with the same idempotency key, and Resend sends nothing twice.
     */
    batchKey: text("batch_key"),
    lastError: text("last_error"),
    /** The provider's id for the sent email. */
    providerId: text("provider_id"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("email_outbox_dedupe_idx").on(t.dedupeKey).where(sql`${t.dedupeKey} IS NOT NULL`),
    index("email_outbox_due_idx").on(t.status, t.nextAttemptAt),
    index("email_outbox_batch_idx").on(t.batchKey).where(sql`${t.batchKey} IS NOT NULL`),
    check("email_outbox_status", sql`${t.status} IN ('pending', 'sending', 'sent', 'failed', 'expired')`),
    check("email_outbox_sent_has_date", sql`${t.status} <> 'sent' OR ${t.sentAt} IS NOT NULL`),
    check("email_outbox_attempts_range", sql`${t.attempts} BETWEEN 0 AND 50`),
  ],
);

/* ── Convenience types ─────────────────────────────────────────────────── */

export type Dealer = typeof dealers.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type VehicleMedia = typeof vehicleMedia.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type VehicleRequest = typeof vehicleRequests.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Commission = typeof commissions.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type OutboxEmail = typeof emailOutbox.$inferSelect;
export type RequestMatch = typeof requestMatches.$inferSelect;
export type VehicleWatch = typeof vehicleWatches.$inferSelect;
export type LeadActivity = typeof leadActivity.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewsletterSend = typeof newsletterSends.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type BlogComment = typeof blogComments.$inferSelect;
export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type AskAnswer = typeof askAnswers.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
