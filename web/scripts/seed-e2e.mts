#!/usr/bin/env node
/**
 * Seeds a throwaway database for the end-to-end suites (e2e/flows), and
 * removes what they leave behind.
 *
 *   npm run e2e:seed            # the dealer, its showroom, three cars — and the staff row, when E2E_STAFF_* are set
 *   npm run e2e:seed -- --clean # delete every row the seed and the suites created
 *
 * Safe to run again and again: every row is keyed on something fixed (the
 * dealer's slug, each car's slug, the staff member's auth id), so a second
 * run updates rather than duplicates, and a car the suite sold is put back
 * on sale.
 *
 * It refuses a Supabase address. The suites write, sell and delete rows;
 * that belongs in a database nobody else is using. Set E2E_ALLOW_REMOTE=1
 * only if you have made one on Supabase for this purpose.
 *
 * The staff row needs SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 * and E2E_STAFF_EMAIL: the row's id must be the Supabase auth user's, which
 * is looked up (never created) through the admin API. Create the user once
 * with `npm run staff:create`.
 */

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { E2E, E2E_NAME_PREFIX, E2E_PHONES, E2E_SLUG_PREFIX, E2E_VEHICLES } from "../e2e/fixtures";
import { site } from "../src/lib/site";

type Sql = ReturnType<typeof postgres>;

/** What a row's first few characters of an email look like in the log — enough to recognise, not enough to copy. */
const maskEmail = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

/** The schema must already be in place (npm run db:migrate); seeding into an empty database only produces confusing errors. */
async function assertSchema(sql: Sql): Promise<void> {
  const [row] = await sql`select to_regclass('public.vehicles') as t, to_regclass('public.incidents') as i`;
  if (!row?.t || !row?.i) throw new Error("The schema is not applied (or not fully). Run npm run db:migrate against this database first.");
}

export async function seed(sql: Sql): Promise<void> {
  await assertSchema(sql);

  // The dealer and its showroom.
  const [dealer] = await sql`
    insert into dealers (slug, name, legal_name, rc_number)
    values (${E2E.dealerSlug}, ${site.name}, ${site.legalName}, ${site.rcNumber})
    on conflict (slug) do update set name = excluded.name, legal_name = excluded.legal_name, rc_number = excluded.rc_number
    returning id, (xmax = 0) as created`;
  console.log(`Dealer "${E2E.dealerSlug}": ${dealer.created ? "created" : "found"}.`);

  let [location] = await sql`select id, name from locations where dealer_id = ${dealer.id} order by name limit 1`;
  if (!location) {
    [location] = await sql`
      insert into locations (dealer_id, name, address_line1, address_line2, city, state, phone)
      values (${dealer.id}, 'Sabicars showroom', ${site.address.line1}, ${site.address.line2}, ${site.address.city}, 'Lagos', ${site.phones[0].e164})
      returning id, name`;
    console.log(`Location "${location.name}": created.`);
  } else {
    console.log(`Location "${location.name}": found.`);
  }

  // Three cars, one at each Drive Plan tier. A car the suite sold is put back on sale with its sale wiped.
  for (const v of E2E_VEHICLES) {
    const [row] = await sql`
      insert into vehicles (dealer_id, location_id, make, model, year, body, segment, condition, mileage_km, fuel, transmission, seats, price_minor, status, slug, description, published_at)
      values (${dealer.id}, ${location.id}, ${v.make}, ${v.model}, ${v.year}, ${v.body}, ${v.segment}, 'foreign_used', 84000, ${v.fuel}, 'automatic', ${v.seats}, ${v.priceMinor}, 'available', ${v.slug},
        'Seeded by scripts/seed-e2e.mts for the end-to-end suite. Not a real listing.', now())
      on conflict (dealer_id, slug) do update set
        make = excluded.make, model = excluded.model, year = excluded.year, body = excluded.body, segment = excluded.segment,
        price_minor = excluded.price_minor, status = 'available', sold_at = null, sold_price_minor = null, location_id = excluded.location_id, updated_at = now()
      returning id, (xmax = 0) as created`;
    console.log(`Vehicle ${v.year} ${v.make} ${v.model} (${v.slug}): ${row.created ? "created" : "found, reset to available"}.`);
  }

  await seedStaff(sql, dealer.id);
}

/** The staff member the money-path test signs in as: an owner whose id is the Supabase auth user with E2E_STAFF_EMAIL. */
async function seedStaff(sql: Sql, dealerId: string): Promise<void> {
  const email = process.env.E2E_STAFF_EMAIL?.trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !supabaseUrl || !serviceKey) {
    console.log("Staff row: skipped. Set SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and E2E_STAFF_EMAIL to add the owner the money-path test signs in as.");
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Supabase would not list users: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 1000) break;
  }
  if (!userId) {
    throw new Error(`No Supabase auth user has the E2E_STAFF_EMAIL address (${maskEmail(email)}). Create it once with npm run staff:create (STAFF_ROLE=owner), then seed again.`);
  }
  const [row] = await sql`
    insert into staff (id, dealer_id, email, full_name, role, is_active, receives_alerts)
    values (${userId}, ${dealerId}, ${email}, 'E2E staff', 'owner', true, false)
    on conflict (id) do update set dealer_id = excluded.dealer_id, email = excluded.email, role = 'owner', is_active = true
    returning (xmax = 0) as created`;
  console.log(`Staff row for ${maskEmail(email)} (owner): ${row.created ? "created" : "found, kept as an active owner"}.`);
}

/**
 * Deletes everything the seed and the suites created, children before
 * parents: payouts, commissions, enquiries, the partner, the cars, and the
 * audit entries and notifications about them. Nothing else is touched.
 */
export async function cleanup(sql: Sql): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await sql.begin(async (tx) => {
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    const vehicleIds = ids(await tx`select id from vehicles where slug like ${E2E_SLUG_PREFIX + "%"}`);
    const partnerIds = ids(await tx`select id from partners where name like ${E2E_NAME_PREFIX + "%"}`);
    const commissionIds = ids(await tx`select id from commissions where vehicle_id = any(${vehicleIds}::uuid[]) or partner_id = any(${partnerIds}::uuid[])`);
    const payoutIds = ids(await tx`select id from payouts where commission_id = any(${commissionIds}::uuid[]) or partner_id = any(${partnerIds}::uuid[])`);
    const leadIds = ids(
      await tx`select id from leads where vehicle_id = any(${vehicleIds}::uuid[]) or partner_id = any(${partnerIds}::uuid[]) or phone = any(${[...E2E_PHONES]}::text[]) or name like ${E2E_NAME_PREFIX + "%"}`,
    );

    counts.payouts = (await tx`delete from payouts where id = any(${payoutIds}::uuid[])`).count;
    counts.commissions = (await tx`delete from commissions where id = any(${commissionIds}::uuid[])`).count;
    counts.leads = (await tx`delete from leads where id = any(${leadIds}::uuid[])`).count;
    counts.partners = (await tx`delete from partners where id = any(${partnerIds}::uuid[])`).count;
    counts.notifications = (await tx`delete from notifications where vehicle_id = any(${vehicleIds}::uuid[])`).count;
    counts.vehicles = (await tx`delete from vehicles where id = any(${vehicleIds}::uuid[])`).count;
    const entityIds = [...vehicleIds, ...partnerIds, ...commissionIds, ...payoutIds, ...leadIds];
    counts.audit_log = (await tx`delete from audit_log where entity_id = any(${entityIds}::text[])`).count;
  });
  return counts;
}

/* ── Command line ──────────────────────────────────────────────────────── */

const runDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runDirectly) {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (the throwaway database for the end-to-end suites).");
    process.exit(1);
  }
  if (/supabase/i.test(url) && process.env.E2E_ALLOW_REMOTE !== "1") {
    console.error(
      "DATABASE_URL points at Supabase. This seed creates cars, partners and payouts and, with --clean, deletes them — never in the live database.\n" +
        "Point DATABASE_URL at a throwaway database (npm run db:local, then npm run db:migrate). If you really made a separate Supabase project for this, set E2E_ALLOW_REMOTE=1.",
    );
    process.exit(1);
  }
  const clean = process.argv.includes("--clean");
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    console.log(`Database: ${new URL(url).host}${clean ? " — cleaning" : " — seeding"}`);
    if (clean) {
      const counts = await cleanup(sql);
      console.log(
        Object.entries(counts)
          .map(([table, n]) => `  ${table.padEnd(14)} ${String(n).padStart(4)} deleted`)
          .join("\n"),
      );
    } else {
      await seed(sql);
    }
    console.log(clean ? "Clean." : "Seeded.");
  } catch (e) {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
