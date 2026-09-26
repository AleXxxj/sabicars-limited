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

console.log(
  `\n${passed} passed, ${failed} failed.` +
    (failed ? "  \x1b[31mSCHEMA NOT VERIFIED\x1b[0m\n" : "  \x1b[32mSchema verified.\x1b[0m\n"),
);
process.exit(failed ? 1 : 0);
