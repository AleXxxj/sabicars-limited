#!/usr/bin/env node
/**
 * The Sourcing Desk's SQL matcher (stockMatching in
 * src/lib/repositories/vehicles.ts) picks exactly the cars the rule in
 * src/lib/matching.ts picks, exact and close, over every car for sale in the
 * database. The fixture cars (scripts/matching-fixtures.ts) are listed for
 * the run under slugs starting "e2e-match-", every want is compared with no
 * limits, a year limit and a budget limit, and the fixtures are removed again.
 *
 *   npm run test:matching-sql      # against DATABASE_URL (CI's throwaway database, or the local one)
 *
 * It refuses a Supabase address: it lists and deletes cars. Set
 * E2E_ALLOW_REMOTE=1 only for a database made for this purpose.
 */

import postgres from "postgres";
import { matchLevel } from "../src/lib/matching";
import { stockMatching } from "../src/lib/repositories/vehicles";
import { FIXTURES, WANTS } from "./matching-fixtures";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the local or throwaway database.");
if (/supabase/i.test(url) && process.env.E2E_ALLOW_REMOTE !== "1") throw new Error("DATABASE_URL points at Supabase: this check lists and deletes cars. Use a throwaway database.");

const PREFIX = "e2e-match-";
const sql = postgres(url, { max: 1, prepare: false });
let failures = 0;
let compared = 0;

try {
  const [dealer] = await sql`select id from dealers where slug = 'sabicars'`;
  if (!dealer) throw new Error("The Sabicars dealer row is missing: run the seed first (npm run e2e:seed).");
  await sql`delete from vehicles where slug like ${`${PREFIX}%`}`;
  for (const [key, v] of Object.entries(FIXTURES)) {
    await sql`
      insert into vehicles (dealer_id, make, model, year, body, condition, fuel, transmission, price_minor, status, slug, description, published_at)
      values (${dealer.id}, ${v.make}, ${v.model}, ${v.year}, ${v.body}, 'foreign_used', ${v.fuel}, ${v.transmission}, ${v.priceMinor}, 'available',
        ${`${PREFIX}${key.toLowerCase()}`}, 'Listed by scripts/verify-matching-sql.mts for one run. Not a real listing.', now())`;
  }

  const cars = (await sql`
    select id, make, model, year, body::text as body, fuel::text as fuel, transmission::text as transmission, price_minor
      from vehicles where dealer_id = ${dealer.id} and status = 'available'`) as {
    id: string; make: string; model: string; year: number; body: string | null; fuel: string | null; transmission: string | null; price_minor: string | null;
  }[];
  const label = (id: string) => {
    const c = cars.find((x) => x.id === id)!;
    return `${c.year} ${c.make} ${c.model}`;
  };

  const limits: [number | null, number | null][] = [[null, null], [2015, null], [null, 3_000_000_000]];
  for (const want of WANTS) {
    for (const [yearFrom, budgetMaxMinor] of limits) {
      const fromSql = await stockMatching(want, yearFrom, budgetMaxMinor, 1000);
      const fromRule = { exact: new Set<string>(), close: new Set<string>() };
      for (const c of cars) {
        const level = matchLevel(
          { make: c.make, model: c.model, year: c.year, priceMinor: c.price_minor === null ? null : Number(c.price_minor), body: c.body, fuel: c.fuel, transmission: c.transmission },
          { want, yearFrom, budgetMaxMinor },
        );
        if (level) fromRule[level].add(c.id);
      }
      for (const level of ["exact", "close"] as const) {
        compared++;
        const picked = new Set(fromSql[level].map((v) => v.id));
        const onlySql = [...picked].filter((id) => !fromRule[level].has(id));
        const onlyRule = [...fromRule[level]].filter((id) => !picked.has(id));
        if (onlySql.length || onlyRule.length) {
          failures++;
          console.log(`FAIL "${want}" (from ${yearFrom ?? "any year"}, up to ${budgetMaxMinor ?? "any budget"}) ${level}: SQL only [${onlySql.map(label).join("; ")}], rule only [${onlyRule.map(label).join("; ")}]`);
        }
      }
    }
  }
} finally {
  await sql`delete from vehicles where slug like ${`${PREFIX}%`}`;
  await sql.end();
}

if (failures) {
  console.error(`${failures} of ${compared} comparisons disagree: the SQL matcher and the rule have drifted apart.`);
  process.exit(1);
}
console.log(`Matching SQL: the database picks the same cars as the rule in all ${compared} comparisons.`);
process.exit(0);
