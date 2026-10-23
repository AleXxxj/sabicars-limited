#!/usr/bin/env node
/**
 * Applies the real migrations to an in-memory Postgres (PGlite) and asserts
 * that the database refuses every state that would cost Sabicars money or
 * credibility.
 *
 * The rules are proven, not assumed. Each assertion names a concrete way the
 * business gets hurt: a price that is not a price, a consigned truck with no
 * owner on record, a car marked sold with no date, a lead nobody can call back.
 *
 *   node scripts/verify-schema.mjs
 */

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "../src/db/migrations");

let passed = 0;
let failed = 0;
const ok = (label) => (passed++, console.log(`  \x1b[32m✓\x1b[0m ${label}`));
const bad = (label, detail) => {
  failed++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m`);
  if (detail) console.log(`      ${String(detail).split("\n")[0]}`);
};

/** Assert a fact about data the database has already accepted. */
function expect(label, condition, detail) {
  if (condition) ok(label);
  else bad(label, detail);
}

async function allows(db, label, sql) {
  try {
    await db.exec(sql);
    ok(label);
  } catch (e) {
    bad(label, e.message);
  }
}

/** The statement must fail, and for the named reason — not some unrelated error. */
async function rejects(db, label, sql, expectFragment) {
  try {
    await db.exec(sql);
    bad(label, "statement was ACCEPTED but should have been rejected");
  } catch (e) {
    if (expectFragment && !e.message.includes(expectFragment)) {
      bad(label, `rejected, but not for the expected reason: ${e.message}`);
    } else {
      ok(label);
    }
  }
}

const db = await PGlite.create();

// Supabase's own starting point: the two Data API roles, granted every table
// the migrations create. The lock below is proved against exactly this.
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
`);

// ── Apply migrations exactly as production will ────────────────────────────
console.log("\nApplying migrations");
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  const statements = readFileSync(join(migrationsDir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    for (const stmt of statements) await db.exec(stmt);
    ok(`${file} (${statements.length} statements)`);
  } catch (e) {
    bad(file, e.message);
    console.log("\nMigration failed — cannot continue.\n");
    process.exit(1);
  }
}

/** Public tables the given role may read or change, by name. */
async function reachable(role) {
  const r = await db.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND has_table_privilege('${role}', c.oid, 'SELECT,INSERT,UPDATE,DELETE')`,
  );
  return r.rows.map((x) => x.relname);
}
const openedByDefault = await reachable("anon");
const lockSql = readFileSync(join(here, "../src/db/lock.sql"), "utf8");
try {
  await db.exec(lockSql);
  ok("lock.sql (every table closed to the Data API, as scripts/migrate.mjs does)");
} catch (e) {
  bad("lock.sql", e.message);
  console.log("\nLock failed — cannot continue.\n");
  process.exit(1);
}

const D = "'d0000000-0000-0000-0000-000000000001'";
const C = "'c0000000-0000-0000-0000-000000000001'";
const V = "'a0000000-0000-0000-0000-000000000001'";
const S = "'50000000-0000-0000-0000-000000000001'";

/** A valid vehicle with one field overridden, to test that field alone. */
function vehicle(overrides = {}) {
  const row = {
    dealer_id: D,
    make: "'Toyota'",
    model: "'Land Cruiser Prado'",
    year: "2014",
    condition: "'foreign_used'",
    price_minor: "3800000000",
    status: "'available'",
    slug: `'test-${Math.random().toString(36).slice(2, 8)}'`,
    ...overrides,
  };
  const cols = Object.keys(row);
  return `INSERT INTO vehicles (${cols.join(", ")}) VALUES (${cols.map((c) => row[c]).join(", ")})`;
}

// ── Fixtures ───────────────────────────────────────────────────────────────
console.log("\nSeeding fixtures");
await allows(db, "create the Sabicars dealer", `INSERT INTO dealers (id, slug, name, rc_number) VALUES (${D}, 'sabicars', 'Sabicars', '1560100')`);
await allows(db, "create the truck importer as a consignor", `INSERT INTO consignors (id, dealer_id, name, country, commission_bps) VALUES (${C}, ${D}, 'Truck importer', 'JP', 1000)`);
await allows(db, "create an owner", `INSERT INTO staff (id, dealer_id, email, role) VALUES (${S}, ${D}, 'owner@sabicars.com', 'owner')`);

// ── Money ──────────────────────────────────────────────────────────────────
console.log("\nMoney");
await allows(db, "stores ₦38,000,000 (3.8bn kobo — beyond a 32-bit integer)", vehicle({ id: V, slug: "'2014-toyota-land-cruiser-prado'" }));
await allows(db, "stores ₦450,000,000 for a luxury vehicle", vehicle({ price_minor: "45000000000" }));
await allows(db, "allows 'price on request' as NULL", vehicle({ price_minor: "NULL" }));
await rejects(db, "refuses a zero price (the legacy 'Call Us' default must never become ₦0)", vehicle({ price_minor: "0" }), "vehicles_price_positive");
await rejects(db, "refuses a negative price", vehicle({ price_minor: "-100" }), "vehicles_price_positive");
await rejects(db, "refuses a 'was' price that is not higher than the price", vehicle({ price_minor: "3800000000", was_price_minor: "3700000000" }), "vehicles_was_price_higher");
await rejects(db, "refuses a 'was' price when there is no price", vehicle({ price_minor: "NULL", was_price_minor: "3700000000" }), "vehicles_was_price_higher");
await allows(db, "allows a genuine reduction", vehicle({ price_minor: "3800000000", was_price_minor: "4200000000" }));

// ── Vehicle facts ──────────────────────────────────────────────────────────
console.log("\nVehicle facts");
await rejects(db, "refuses year 214 (a slipped digit)", vehicle({ year: "214" }), "vehicles_year_range");
await rejects(db, "refuses seats = 0", vehicle({ seats: "0" }), "vehicles_seats_range");
await rejects(db, "refuses 500 seats", vehicle({ seats: "500" }), "vehicles_seats_range");
await allows(db, "allows an 18-seat Hiace", vehicle({ seats: "18", body: "'bus'", segment: "'commercial'" }));
await rejects(db, "refuses negative mileage", vehicle({ mileage_km: "-1" }), "vehicles_mileage_range");
await rejects(db, "refuses a gearbox stored as a drivetrain", vehicle({ drivetrain: "'9G-TRONIC'" }), "invalid input value for enum drivetrain_type");
await rejects(db, "refuses an unknown condition", vehicle({ condition: "'like new'" }), "invalid input value for enum vehicle_condition");
await rejects(db, "refuses a slug with spaces or capitals", vehicle({ slug: "'Toyota Prado 2014'" }), "vehicles_slug_format");
await rejects(db, "refuses two vehicles with the same address", vehicle({ slug: "'2014-toyota-land-cruiser-prado'" }), "vehicles_dealer_slug_idx");

// ── Ownership and custody ──────────────────────────────────────────────────
console.log("\nOwnership and custody");
await allows(db, "records a consigned truck with its owner", vehicle({ make: "'Isuzu'", model: "'Giga'", body: "'truck'", owner_kind: "'consignor'", consignor_id: C }));
await rejects(db, "refuses a consigned vehicle with no consignor on record", vehicle({ owner_kind: "'consignor'" }), "vehicles_consignor_matches_owner");
await rejects(db, "refuses a dealer-owned vehicle that names a consignor", vehicle({ owner_kind: "'dealer'", consignor_id: C }), "vehicles_consignor_matches_owner");
await rejects(db, "refuses a consignor commission above 100%", `INSERT INTO consignors (dealer_id, name, commission_bps) VALUES (${D}, 'x', 10001)`, "consignors_commission_range");

// ── Lifecycle ──────────────────────────────────────────────────────────────
console.log("\nLifecycle");
await rejects(db, "refuses marking a car sold without the date it sold", `UPDATE vehicles SET status = 'sold' WHERE id = ${V}`, "vehicles_sold_has_date");
await allows(db, "marks a car sold with its date", `UPDATE vehicles SET status = 'sold', sold_at = now() WHERE id = ${V}`);
await allows(db, "records what a sold car sold for", `UPDATE vehicles SET sold_price_minor = 3700000000 WHERE id = ${V}`);
await rejects(db, "refuses a sale price on a car that has not sold", vehicle({ sold_price_minor: "3700000000" }), "vehicles_sold_price_only_when_sold");
await rejects(db, "refuses a sale price of zero", `UPDATE vehicles SET sold_price_minor = 0 WHERE id = ${V}`, "vehicles_sold_price_positive");

// ── Media ──────────────────────────────────────────────────────────────────
console.log("\nMedia");
await allows(db, "attaches a cover photo", `INSERT INTO vehicle_media (vehicle_id, url, position) VALUES (${V}, 'https://res.cloudinary.com/x/image/upload/a.jpg', 0)`);
await rejects(db, "refuses two photos in the same position", `INSERT INTO vehicle_media (vehicle_id, url, position) VALUES (${V}, 'https://res.cloudinary.com/x/image/upload/b.jpg', 0)`, "vehicle_media_position_idx");
await rejects(db, "refuses an insecure http:// image (breaks on an https page)", `INSERT INTO vehicle_media (vehicle_id, url, position) VALUES (${V}, 'http://example.com/c.jpg', 1)`, "vehicle_media_https");
await allows(db, "deleting a vehicle removes its media", `DELETE FROM vehicles WHERE id = ${V}`);
const orphans = await db.query(`SELECT count(*)::int AS n FROM vehicle_media WHERE vehicle_id = ${V}`);
expect("no orphaned media rows remain", orphans.rows[0].n === 0, `${orphans.rows[0].n} left`);

// ── Leads ──────────────────────────────────────────────────────────────────
console.log("\nLeads");
await allows(db, "records a lead with a phone number", `INSERT INTO leads (dealer_id, type, channel, name, phone) VALUES (${D}, 'viewing', 'web_form', 'Ada', '+2348000000000')`);
await rejects(db, "refuses a lead nobody can call or email back", `INSERT INTO leads (dealer_id, type, channel, name) VALUES (${D}, 'question', 'web_form', 'Ada')`, "leads_reachable");
await rejects(db, "refuses a lead with a blank name", `INSERT INTO leads (dealer_id, type, channel, name, phone) VALUES (${D}, 'question', 'web_form', '   ', '+2348000000000')`, "leads_name_present");

// ── Sourcing Desk ──────────────────────────────────────────────────────────
console.log("\nSourcing Desk");
const L = "'1e000000-0000-0000-0000-000000000001'";
await allows(db, "records a sourcing lead", `INSERT INTO leads (id, dealer_id, type, channel, name, phone) VALUES (${L}, ${D}, 'sourcing', 'web_form', 'Ada', '+2348000000001')`);
await allows(db, "records a standing request against it", `INSERT INTO vehicle_requests (dealer_id, lead_id, want, year_from, budget_max_minor, payment) VALUES (${D}, ${L}, 'Toyota Highlander', 2018, 2500000000, 'drive_plan')`);
await rejects(db, "refuses a second request on the same lead", `INSERT INTO vehicle_requests (dealer_id, lead_id, want) VALUES (${D}, ${L}, 'Lexus RX')`, "vehicle_requests_lead_idx");
await rejects(db, "refuses a request with no vehicle named", `INSERT INTO vehicle_requests (dealer_id, lead_id, want) VALUES (${D}, gen_random_uuid(), ' ')`, "vehicle_requests_want_present");
await rejects(db, "refuses a zero budget", `INSERT INTO leads (id, dealer_id, type, channel, name, phone) VALUES ('1e000000-0000-0000-0000-000000000002', ${D}, 'sourcing', 'web_form', 'Ada', '+2348000000001'); INSERT INTO vehicle_requests (dealer_id, lead_id, want, budget_max_minor) VALUES (${D}, '1e000000-0000-0000-0000-000000000002', 'Hiace', 0)`, "vehicle_requests_budget_positive");
await rejects(db, "refuses a request for a car from the year 1066", `INSERT INTO vehicle_requests (dealer_id, lead_id, want, year_from) VALUES (${D}, '1e000000-0000-0000-0000-000000000002', 'Hiace', 1066)`, "vehicle_requests_year_range");
await allows(db, "deleting the lead removes its request", `DELETE FROM leads WHERE id = ${L}`);
const reqLeft = await db.query(`SELECT count(*)::int AS n FROM vehicle_requests WHERE lead_id = ${L}`);
expect("no orphaned requests remain", reqLeft.rows[0].n === 0, `${reqLeft.rows[0].n} left`);

// ── Matching ───────────────────────────────────────────────────────────────
console.log("\nMatching");
const L2 = "'1e000000-0000-0000-0000-000000000003'";
const R2 = "'2e000000-0000-0000-0000-000000000003'";
const V2 = "'a0000000-0000-0000-0000-000000000002'";
await allows(db, "a request staff are sourcing for", `INSERT INTO leads (id, dealer_id, type, channel, name, phone) VALUES (${L2}, ${D}, 'sourcing', 'web_form', 'Ada', '+2348000000009'); INSERT INTO vehicle_requests (id, dealer_id, lead_id, want, status) VALUES (${R2}, ${D}, ${L2}, 'Hiace', 'sourcing')`);
await allows(db, "offers a vehicle against it", `${vehicle({ id: V2 })}; INSERT INTO request_matches (request_id, vehicle_id) VALUES (${R2}, ${V2})`);
await rejects(db, "refuses offering the same vehicle to the same request twice", `INSERT INTO request_matches (request_id, vehicle_id) VALUES (${R2}, ${V2})`, "request_matches_pair_idx");
await rejects(db, "refuses a match marked sent without when", `UPDATE request_matches SET status = 'sent' WHERE request_id = ${R2}`, "request_matches_sent_has_date");
await allows(db, "records a match as sent, with its channel and time", `UPDATE request_matches SET status = 'sent', channel = 'email', sent_at = now() WHERE request_id = ${R2}`);
await allows(db, "deleting the vehicle removes its offers", `DELETE FROM vehicles WHERE id = ${V2}`);
const matchLeft = await db.query(`SELECT count(*)::int AS n FROM request_matches WHERE request_id = ${R2}`);
expect("no offers of a deleted vehicle remain", matchLeft.rows[0].n === 0, `${matchLeft.rows[0].n} left`);

// ── Autochek and watches ───────────────────────────────────────────────────
console.log("\nAutochek and watches");
const V3 = "'a0000000-0000-0000-0000-000000000003'";
const L3 = "'1e000000-0000-0000-0000-000000000004'";
await allows(db, "records a vehicle's Autochek listing", vehicle({ id: V3, autochek_url: "'https://autochek.africa/ng/car/toyota-hiace-abc'" }));
await rejects(db, "refuses an insecure Autochek link", vehicle({ autochek_url: "'http://autochek.africa/x'" }), "vehicles_autochek_https");
await allows(db, "a buyer watches it for a price drop", `INSERT INTO leads (id, dealer_id, type, channel, name, phone) VALUES (${L3}, ${D}, 'watch', 'web_form', 'Ada', '+2348000000010'); INSERT INTO vehicle_watches (dealer_id, lead_id, vehicle_id, known_price_minor) VALUES (${D}, ${L3}, ${V3}, 3800000000)`);
await rejects(db, "refuses watching the same car twice on one lead", `INSERT INTO vehicle_watches (dealer_id, lead_id, vehicle_id) VALUES (${D}, ${L3}, ${V3})`, "vehicle_watches_lead_vehicle_idx");
await rejects(db, "refuses an alert marked sent without when", `UPDATE vehicle_watches SET alert_status = 'sent' WHERE lead_id = ${L3}`, "vehicle_watches_sent_has_date");
await allows(db, "deleting the vehicle removes its watches", `DELETE FROM vehicles WHERE id = ${V3}`);
const watchLeft = await db.query(`SELECT count(*)::int AS n FROM vehicle_watches WHERE lead_id = ${L3}`);
expect("no watches on a deleted vehicle remain", watchLeft.rows[0].n === 0, `${watchLeft.rows[0].n} left`);

// ── Lead engine ────────────────────────────────────────────────────────────
console.log("\nLead engine");
const L4 = "'1e000000-0000-0000-0000-000000000005'";
const ST = "'5a000000-0000-0000-0000-000000000009'";
await allows(db, "a staff member receives alerts by default", `INSERT INTO staff (id, dealer_id, email) VALUES (${ST}, ${D}, 'alerts@sabicars.com')`);
const rcv = await db.query(`SELECT receives_alerts FROM staff WHERE id = ${ST}`);
expect("new staff are alerted unless switched off", rcv.rows[0].receives_alerts === true);
await allows(db, "records a lead's history", `INSERT INTO leads (id, dealer_id, type, channel, name, phone) VALUES (${L4}, ${D}, 'question', 'web_form', 'Ada', '+2348000000011'); INSERT INTO lead_activity (lead_id, staff_id, kind, detail) VALUES (${L4}, ${ST}, 'contacted', 'call')`);
await rejects(db, "refuses an activity that is not in the vocabulary", `INSERT INTO lead_activity (lead_id, kind) VALUES (${L4}, 'gossip')`, "invalid input value for enum");
await allows(db, "subscribes a phone to push alerts", `INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth) VALUES (${ST}, 'https://fcm.googleapis.com/fcm/send/abc', 'k', 'a')`);
await rejects(db, "refuses the same phone twice", `INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth) VALUES (${ST}, 'https://fcm.googleapis.com/fcm/send/abc', 'k', 'a')`, "push_subscriptions_endpoint_idx");
await rejects(db, "refuses an insecure push endpoint", `INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth) VALUES (${ST}, 'http://example.com/x', 'k', 'a')`, "push_subscriptions_https");
await allows(db, "removing a staff member keeps the lead's history, unattributed", `DELETE FROM push_subscriptions WHERE staff_id = ${ST}; DELETE FROM staff WHERE id = ${ST}`);
const hist = await db.query(`SELECT count(*)::int AS n, count(staff_id)::int AS attributed FROM lead_activity WHERE lead_id = ${L4}`);
expect("the history survives, without the departed name", hist.rows[0].n === 1 && hist.rows[0].attributed === 0, JSON.stringify(hist.rows[0]));
await allows(db, "deleting the lead removes its history", `DELETE FROM leads WHERE id = ${L4}`);

// ── Refer & Earn ───────────────────────────────────────────────────────────
console.log("\nRefer & Earn");
const P = "'9a000000-0000-0000-0000-000000000001'";
await allows(db, "registers a partner", `INSERT INTO partners (id, dealer_id, code, name, phone) VALUES (${P}, ${D}, 'ADA7K3', 'Ada', '+2348031234567')`);
await rejects(db, "refuses a second registration for the same phone", `INSERT INTO partners (dealer_id, code, name, phone) VALUES (${D}, 'ADB7K3', 'Ada B', '+2348031234567')`, "partners_dealer_phone_idx");
await rejects(db, "refuses a code another partner holds", `INSERT INTO partners (dealer_id, code, name, phone) VALUES (${D}, 'ADA7K3', 'Bola', '+2348031234568')`, "partners_code_idx");
await rejects(db, "refuses a lower-case or malformed code", `INSERT INTO partners (dealer_id, code, name, phone) VALUES (${D}, 'ada7k', 'Bola', '+2348031234568')`, "partners_code_format");
await rejects(db, "refuses a phone number not in international form", `INSERT INTO partners (dealer_id, code, name, phone) VALUES (${D}, 'BOL123', 'Bola', '08031234568')`, "partners_phone_e164");
await allows(db, "attributes a lead to a partner", `INSERT INTO leads (dealer_id, type, channel, name, phone, partner_id) VALUES (${D}, 'question', 'web_form', 'Buyer', '+2348000000002', ${P})`);
await rejects(db, "refuses attribution to a partner who does not exist", `INSERT INTO leads (dealer_id, type, channel, name, phone, partner_id) VALUES (${D}, 'question', 'web_form', 'Buyer', '+2348000000003', gen_random_uuid())`, "leads_partner_id_partners_id_fk");

// ── People and audience ────────────────────────────────────────────────────
console.log("\nPeople and audience");
await rejects(db, "refuses the same staff email twice, whatever the case", `INSERT INTO staff (id, dealer_id, email) VALUES (gen_random_uuid(), ${D}, 'Owner@Sabicars.com')`, "staff_email_idx");
await allows(db, "subscribes an email", `INSERT INTO subscribers (dealer_id, email) VALUES (${D}, 'buyer@example.com')`);
await rejects(db, "refuses the same subscriber twice, whatever the case", `INSERT INTO subscribers (dealer_id, email) VALUES (${D}, 'BUYER@example.com')`, "subscribers_dealer_email_idx");
const tok = await db.query(`SELECT unsubscribe_token FROM subscribers LIMIT 1`);
expect("every subscriber gets an unsubscribe token", Boolean(tok.rows[0]?.unsubscribe_token));
await rejects(db, "refuses a 6-star review", `INSERT INTO reviews (dealer_id, name, rating, message) VALUES (${D}, 'x', 6, 'y')`, "reviews_rating_range");
const rv = await db.query(`INSERT INTO reviews (dealer_id, name, rating, message) VALUES (${D}, 'x', 5, 'y') RETURNING is_approved`);
expect("new reviews wait for approval before publishing", rv.rows[0].is_approved === false);
await rejects(db, "refuses a published post with no publish date", `INSERT INTO blog_posts (dealer_id, slug, title, category, excerpt, content, is_published) VALUES (${D}, 's', 't', 'c', 'e', 'b', true)`, "blog_posts_published_has_date");

// ── Sell or trade in ───────────────────────────────────────────────────────
console.log("\nSell or trade in");
await allows(db, "records someone offering their own car", `INSERT INTO leads (dealer_id, type, channel, name, phone, message) VALUES (${D}, 'sell', 'web_form', 'Ada', '+2348000000031', 'Car: 2015 Toyota Camry')`);

// ── Viewing slots ──────────────────────────────────────────────────────────
console.log("\nViewing slots");
await allows(db, "books a viewing for a time", `INSERT INTO leads (dealer_id, type, channel, name, phone, viewing_at) VALUES (${D}, 'viewing', 'web_form', 'Ada', '+2348000000021', '2026-10-24T09:00:00Z')`);
await rejects(db, "refuses a viewing time on an enquiry that is not a viewing", `INSERT INTO leads (dealer_id, type, channel, name, phone, viewing_at) VALUES (${D}, 'question', 'web_form', 'Ada', '+2348000000022', '2026-10-24T09:00:00Z')`, "leads_viewing_time_only_on_viewings");

// ── Sabicars Verified ──────────────────────────────────────────────────────
console.log("\nSabicars Verified");
const VV = "'a0000000-0000-0000-0000-000000000009'";
const complete = "inspected_at = now(), inspector_name = 'Tunde (mechanic)', odometer_km = 94000, published_at = now()";
await allows(db, "starts a draft report with only its code", `${vehicle({ id: VV, slug: "'2013-toyota-hiace-hummer-1'" })}; INSERT INTO inspections (dealer_id, vehicle_id, code) VALUES (${D}, ${VV}, '7K3P9Q')`);
await rejects(db, "refuses a code with a misreadable character (0 or O, 1 or I)", `INSERT INTO inspections (dealer_id, vehicle_id, code) VALUES (${D}, ${VV}, '7K3P0Q')`, "inspections_code_format");
await rejects(db, "refuses a lower-case code", `INSERT INTO inspections (dealer_id, vehicle_id, code) VALUES (${D}, ${VV}, '7k3p9q')`, "inspections_code_format");
await rejects(db, "refuses a code another report holds", `INSERT INTO inspections (dealer_id, vehicle_id, code) VALUES (${D}, ${VV}, '7K3P9Q')`, "inspections_code_idx");
await rejects(db, "refuses publishing without a date, inspector or odometer reading", `UPDATE inspections SET status = 'published', published_at = now() WHERE code = '7K3P9Q'`, "inspections_published_complete");
await rejects(db, "refuses publishing with a blank inspector name", `UPDATE inspections SET status = 'published', inspected_at = now(), inspector_name = '  ', odometer_km = 94000, published_at = now() WHERE code = '7K3P9Q'`, "inspections_published_complete");
await allows(db, "publishes a complete report", `UPDATE inspections SET status = 'published', ${complete} WHERE code = '7K3P9Q'`);
await rejects(db, "refuses a second live report for the same car", `INSERT INTO inspections (dealer_id, vehicle_id, code, status, inspected_at, inspector_name, odometer_km, published_at) VALUES (${D}, ${VV}, '8M4R2T', 'published', now(), 'Tunde', 95000, now())`, "inspections_one_published_idx");
await allows(db, "a newer report replaces the old one once it is superseded", `UPDATE inspections SET status = 'superseded' WHERE code = '7K3P9Q'; INSERT INTO inspections (dealer_id, vehicle_id, code, status, inspected_at, inspector_name, odometer_km, published_at) VALUES (${D}, ${VV}, '8M4R2T', 'published', now(), 'Tunde', 95000, now())`);
await rejects(db, "refuses a negative odometer reading", `INSERT INTO inspections (dealer_id, vehicle_id, code, odometer_km) VALUES (${D}, ${VV}, '9N5S3U', -1)`, "inspections_odometer_range");
await rejects(db, "refuses a title status outside the vocabulary", `INSERT INTO inspections (dealer_id, vehicle_id, code, history_title) VALUES (${D}, ${VV}, '9N5S3U', 'probably fine')`, "invalid input value for enum history_title");
await allows(db, "deleting a vehicle removes its reports", `DELETE FROM vehicles WHERE id = ${VV}`);
const left = await db.query(`SELECT count(*)::int AS n FROM inspections`);
expect("no report outlives its vehicle", left.rows[0].n === 0, JSON.stringify(left.rows[0]));

// ── Commission ledger ──────────────────────────────────────────────────────
// Each rule here is money: a second commission on one car pays a partner
// twice, a payout before the cooling-off pays for a sale that may unwind,
// and a transfer to an unverified account pays somebody else.
console.log("\nCommission ledger");
const VS = "'a0000000-0000-0000-0000-000000000021'"; // sold, with its price: earns a commission
const VS2 = "'a0000000-0000-0000-0000-000000000022'"; // sold too, kept free of commissions so each CHECK is tested alone
const CM = "'c1000000-0000-0000-0000-000000000001'";

/** A valid commission on VS, with one field overridden, to test that field alone. */
function commission(overrides = {}) {
  const row = {
    dealer_id: D,
    partner_id: P,
    vehicle_id: VS,
    source: "'link'",
    sale_price_minor: "3700000000",
    rate_bps: "150",
    amount_minor: "55500000",
    earned_at: "now()",
    payable_at: "now() + interval '48 hours'",
    ...overrides,
  };
  const cols = Object.keys(row);
  return `INSERT INTO commissions (${cols.join(", ")}) VALUES (${cols.map((c) => row[c]).join(", ")})`;
}

/** A valid payout of CM, with one field overridden. `status = 'failed'` (with its reason) keeps a CHECK test clear of the one-live-payout index. */
function payout(overrides = {}) {
  const row = {
    dealer_id: D,
    commission_id: CM,
    partner_id: P,
    amount_minor: "55500000",
    method: "'paystack'",
    status: "'pending'",
    reference: "'scp_0123abcd_89efghij'",
    ...overrides,
  };
  const cols = Object.keys(row);
  return `INSERT INTO payouts (${cols.join(", ")}) VALUES (${cols.map((c) => row[c]).join(", ")})`;
}

const tokenRow = await db.query(`SELECT access_token FROM partners WHERE id = ${P}`);
expect("every partner gets a private page token", Boolean(tokenRow.rows[0]?.access_token));

await allows(db, "records two cars sold for ₦37,000,000 each", `${vehicle({ id: VS, status: "'sold'", sold_at: "now()", sold_price_minor: "3700000000" })}; ${vehicle({ id: VS2, status: "'sold'", sold_at: "now()", sold_price_minor: "3700000000" })}`);
await allows(db, "records the 1.5% commission on a sale a partner brought in (₦555,000, payable after 48 hours)", commission({ id: CM }));
await rejects(db, "refuses a second commission on the same car", commission({ source: "'manual'" }), "commissions_one_per_vehicle_idx");
await rejects(db, "refuses a commission of nothing", commission({ vehicle_id: VS2, amount_minor: "0" }), "commissions_amount_positive");
await rejects(db, "refuses a commission on a sale of nothing", commission({ vehicle_id: VS2, sale_price_minor: "0" }), "commissions_sale_positive");
await rejects(db, "refuses a source outside link or manual", commission({ vehicle_id: VS2, source: "'guess'" }), "commissions_source");
await rejects(db, "refuses a payout date before the sale (no cooling-off)", commission({ vehicle_id: VS2, payable_at: "now() - interval '1 hour'" }), "commissions_cooling_off");
await rejects(db, "refuses a commission marked paid without when", commission({ vehicle_id: VS2, status: "'paid'" }), "commissions_paid_has_date");
await rejects(db, "refuses a commission voided without a reason the partner can read", commission({ vehicle_id: VS2, status: "'void'", voided_at: "now()" }), "commissions_void_has_reason");
await allows(db, "a voided commission steps aside for a later, real sale", `${commission({ vehicle_id: VS2, status: "'void'", voided_at: "now()", void_reason: "'Sale fell through'" })}; ${commission({ vehicle_id: VS2 })}`);

await allows(db, "starts a Paystack payout under our own reference", payout());
await rejects(db, "refuses a reference not in our shape (Paystack's idempotency key)", payout({ status: "'failed'", failure_reason: "'x'", reference: "'TRF_abc123'" }), "payouts_reference_format");
await rejects(db, "refuses a second live payout for the same commission", payout({ reference: "'scp_0123abcd_89efghik'" }), "payouts_one_live_per_commission_idx");
await rejects(db, "refuses the same reference twice", payout({ status: "'failed'", failure_reason: "'x'" }), "payouts_reference_idx");
await rejects(db, "refuses a payout in cash", payout({ status: "'failed'", failure_reason: "'x'", reference: "'scp_0123abcd_89efghil'", method: "'cash'" }), "payouts_method");
await rejects(db, "refuses a bank transfer recorded without the bank's reference", payout({ status: "'failed'", failure_reason: "'x'", reference: "'scp_0123abcd_89efghim'", method: "'bank_transfer'" }), "payouts_manual_has_bank_reference");
await rejects(db, "refuses a payout marked paid without when", payout({ reference: "'scp_0123abcd_89efghin'", commission_id: "gen_random_uuid()", status: "'paid'" }), "payouts_paid_has_date");
await rejects(db, "refuses a failed payout with no reason", `UPDATE payouts SET status = 'failed' WHERE reference = 'scp_0123abcd_89efghij'`, "payouts_failed_has_reason");
await allows(db, "a failed transfer is retried with a new row", `UPDATE payouts SET status = 'failed', failure_reason = 'Bank unavailable' WHERE reference = 'scp_0123abcd_89efghij'; ${payout({ reference: "'scp_0123abcd_89efghio'" })}`);

await rejects(db, "refuses an 11-digit account number (a NUBAN has ten)", `UPDATE partners SET bank_code = '058', bank_name = 'Guaranty Trust Bank', account_number = '01234567890' WHERE id = ${P}`, "partners_account_nuban");
await rejects(db, "refuses an account number without its bank", `UPDATE partners SET account_number = '0123456789' WHERE id = ${P}`, "partners_account_complete");
await rejects(db, "refuses a Paystack recipient on an account nobody has verified", `UPDATE partners SET bank_code = '058', bank_name = 'Guaranty Trust Bank', account_number = '0123456789', paystack_recipient_code = 'RCP_test' WHERE id = ${P}`, "partners_recipient_needs_verification");
await allows(db, "records a verified account with its Paystack recipient", `UPDATE partners SET bank_code = '058', bank_name = 'Guaranty Trust Bank', account_number = '0123456789', account_name = 'ADA OKAFOR', account_verified_at = now(), account_verified_by = ${S}, paystack_recipient_code = 'RCP_test' WHERE id = ${P}`);

// ── Throttles and the email outbox ─────────────────────────────────────────
// The throttle must count one address in one window on one row, or two server
// instances each allow the full ceiling; it must never hold an address in the
// clear. The outbox must never claim an email was sent without saying when,
// and a dedupe key must mean one email, or a welcome repeated by a stranger
// floods a partner's inbox.
console.log("\nThrottles and the email outbox");
const KEY = "'0123456789abcdef0123456789abcdef'";
const WIN = "'2026-10-22T09:00:00Z'";
await allows(db, "counts one use of a form by one hashed address", `INSERT INTO rate_limits (bucket, key_hash, window_start) VALUES ('enquiry', ${KEY}, ${WIN})`);
await rejects(db, "refuses a second row for the same form, address and window", `INSERT INTO rate_limits (bucket, key_hash, window_start) VALUES ('enquiry', ${KEY}, ${WIN})`, "rate_limits_bucket_key_hash_window_start_pk");
await allows(
  db,
  "counts up on the same row instead (the limiter's own upsert)",
  `INSERT INTO rate_limits (bucket, key_hash, window_start, count) VALUES ('enquiry', ${KEY}, ${WIN}, 1) ON CONFLICT (bucket, key_hash, window_start) DO UPDATE SET count = rate_limits.count + 1`,
);
const counted = await db.query(`SELECT count FROM rate_limits WHERE bucket = 'enquiry' AND key_hash = ${KEY}`);
expect("the count is 2 on one row", counted.rows.length === 1 && counted.rows[0].count === 2, JSON.stringify(counted.rows));
await allows(db, "the same address in the next window starts its own row", `INSERT INTO rate_limits (bucket, key_hash, window_start) VALUES ('enquiry', ${KEY}, '2026-10-22T09:10:00Z')`);
await rejects(db, "refuses a count of zero", `INSERT INTO rate_limits (bucket, key_hash, window_start, count) VALUES ('partner', ${KEY}, ${WIN}, 0)`, "rate_limits_count_positive");
await rejects(db, "refuses an address stored in the clear instead of hashed", `INSERT INTO rate_limits (bucket, key_hash, window_start) VALUES ('partner', '102.89.34.7', ${WIN})`, "rate_limits_key_hash_format");
await rejects(db, "refuses a hash of the wrong shape (capitals)", `INSERT INTO rate_limits (bucket, key_hash, window_start) VALUES ('partner', '0123456789ABCDEF0123456789ABCDEF', ${WIN})`, "rate_limits_key_hash_format");

/** A valid outbox email with one field overridden, to test that field alone. */
function outbox(overrides = {}) {
  const row = { to_address: "'ada@example.com'", subject: "'Welcome'", html: "'<p>Hi</p>'", text_body: "'Hi'", ...overrides };
  const cols = Object.keys(row);
  return `INSERT INTO email_outbox (${cols.join(", ")}) VALUES (${cols.map((c) => row[c]).join(", ")})`;
}
const ob = await db.query(`${outbox()} RETURNING status, attempts, next_attempt_at <= now() AS due`);
expect("a new email waits as pending, untried, due at once", ob.rows[0]?.status === "pending" && ob.rows[0]?.attempts === 0 && ob.rows[0]?.due === true, JSON.stringify(ob.rows[0]));
await rejects(db, "refuses a status outside the vocabulary", outbox({ status: "'queued'" }), "email_outbox_status");
await rejects(db, "refuses an email marked sent without when", outbox({ status: "'sent'" }), "email_outbox_sent_has_date");
await allows(db, "records a sent email with its time", outbox({ status: "'sent'", sent_at: "now()", attempts: "1" }));
await rejects(db, "refuses a negative attempt count", outbox({ attempts: "-1" }), "email_outbox_attempts_range");
await rejects(db, "refuses more than 50 attempts (a retry loop gone wrong)", outbox({ attempts: "51" }), "email_outbox_attempts_range");
await allows(db, "stores an email under a dedupe key", outbox({ dedupe_key: "'welcome:p1:2026-10-22'" }));
await rejects(db, "refuses a second email with the same dedupe key", outbox({ dedupe_key: "'welcome:p1:2026-10-22'" }), "email_outbox_dedupe_idx");
await allows(db, "allows any number of emails without a key", `${outbox()}; ${outbox()}`);
await allows(
  db,
  "drops a repeat quietly with the statement sendEmail uses",
  `${outbox({ dedupe_key: "'welcome:p1:2026-10-22'" })} ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
);
const keyed = await db.query(`SELECT count(*)::int AS n FROM email_outbox WHERE dedupe_key = 'welcome:p1:2026-10-22'`);
expect("the keyed email is stored once", keyed.rows[0].n === 1, `${keyed.rows[0].n} rows`);

// ── Closed to Supabase's Data API ──────────────────────────────────────────
console.log("\nClosed to the Data API");
expect(
  "without the lock, Supabase's defaults open every table to anyone with the publishable key",
  openedByDefault.length > 20,
  `only ${openedByDefault.length} tables were open before the lock`,
);
const noRls = await db.query(
  `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
);
expect("every table has Row Level Security on", noRls.rows.length === 0, noRls.rows.map((r) => r.relname).join(", "));
for (const role of ["anon", "authenticated"]) {
  const open = await reachable(role);
  expect(`${role} can read or change no table`, open.length === 0, open.join(", "));
}
try {
  await db.exec(`SET ROLE anon; SELECT count(*) FROM staff`);
  bad("the publishable key cannot read staff", "the read was allowed");
} catch (e) {
  expect("the publishable key cannot read staff", /permission denied/.test(e.message), e.message);
} finally {
  await db.exec(`RESET ROLE`);
}
await db.exec(`CREATE TABLE lock_probe (id int); INSERT INTO lock_probe VALUES (1)`);
expect("a table created later is not granted to anon", !(await reachable("anon")).includes("lock_probe"));
await db.exec(lockSql);
const probe = await db.query(`SELECT relrowsecurity AS on FROM pg_class WHERE relname = 'lock_probe'`);
expect("running the lock again closes a table created since", probe.rows[0]?.on === true);
// Even granted by mistake, a table shows no rows: no policy lets anyone but the owner see one.
await db.exec(`GRANT SELECT ON vehicles, lock_probe TO anon`);
try {
  await db.exec(`SET ROLE anon`);
  const seen = await db.query(`SELECT (SELECT count(*) FROM vehicles)::int AS v, (SELECT count(*) FROM lock_probe)::int AS p`);
  expect("a mistaken grant still shows no rows", seen.rows[0].v === 0 && seen.rows[0].p === 0, JSON.stringify(seen.rows[0]));
} finally {
  await db.exec(`RESET ROLE; REVOKE ALL ON vehicles, lock_probe FROM anon; DROP TABLE lock_probe`);
}
const ownerSees = await db.query(`SELECT count(*)::int AS n FROM vehicles`);
expect("the site's own connection still sees every row", ownerSees.rows[0].n > 0, `${ownerSees.rows[0].n} vehicles`);

console.log(
  `\n${passed} passed, ${failed} failed.` +
    (failed ? "  \x1b[31mSCHEMA NOT VERIFIED\x1b[0m\n" : "  \x1b[32mSchema verified.\x1b[0m\n"),
);
process.exit(failed ? 1 : 0);
