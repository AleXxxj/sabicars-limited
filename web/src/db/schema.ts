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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("leads_legacy_idx").on(t.legacyId),
    index("leads_dealer_status_idx").on(t.dealerId, t.status, t.createdAt),
    index("leads_assigned_idx").on(t.assignedTo, t.status),
    check("leads_reachable", sql`${t.phone} IS NOT NULL OR ${t.email} IS NOT NULL`),
    check("leads_name_present", sql`length(btrim(${t.name})) > 0`),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("partners_code_idx").on(t.code),
    uniqueIndex("partners_dealer_phone_idx").on(t.dealerId, t.phone),
    check("partners_code_format", sql`${t.code} ~ '^[A-Z0-9]{6}$'`),
    check("partners_phone_e164", sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check("partners_name_present", sql`length(btrim(${t.name})) > 0`),
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
     * on its front page unread.
     */
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_legacy_idx").on(t.legacyId),
    check("reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
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
    /** HTML from the legacy editor. Sanitised on render, never trusted. */
    content: text("content").notNull(),
    coverImageUrl: text("cover_image_url"),
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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("blog_comments_legacy_idx").on(t.legacyId)],
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
    /** car | blog | offer | system */
    kind: text("kind").notNull().default("system"),
    link: text("link"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notifications_legacy_idx").on(t.legacyId),
    index("notifications_recent_idx").on(t.dealerId, t.createdAt),
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
export type RequestMatch = typeof requestMatches.$inferSelect;
