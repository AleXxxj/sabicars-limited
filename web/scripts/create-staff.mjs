#!/usr/bin/env node
/**
 * Creates a staff account: a Supabase auth user plus the matching `staff` row.
 *
 * Both are required. A Supabase account alone does NOT open the admin —
 * requireStaff() separately checks for an active `staff` row, so a stray
 * sign-up can never reach customer data.
 *
 * The password comes from the environment so it is never written to a file,
 * never committed, and never passed as a command argument. Read it silently
 * first — typed inline (STAFF_PASSWORD='…' npm run …) it lands in shell
 * history. Run it yourself; never paste a password into a chat or a ticket.
 *
 *   read -rs "STAFF_PASSWORD?Choose a password: "; export STAFF_PASSWORD; echo
 *   STAFF_EMAIL="owner@sabicars.com" STAFF_NAME="Christ D" STAFF_ROLE=owner npm run staff:create
 *   unset STAFF_PASSWORD
 *
 * STAFF_ROLE: owner | manager | sales   (default: sales)
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
const password = process.env.STAFF_PASSWORD;
const role = (process.env.STAFF_ROLE ?? "sales").trim();
const fullName = process.env.STAFF_NAME?.trim() || null;
const phone = process.env.STAFF_PHONE?.trim() || null;

if (!email || !password) {
  console.error("Set STAFF_EMAIL and STAFF_PASSWORD (see the header of this file).");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Use a password of at least 12 characters — this account can see customer details and edit live inventory.");
  process.exit(1);
}
if (!["owner", "manager", "sales"].includes(role)) {
  console.error(`STAFF_ROLE must be owner, manager or sales (got "${role}").`);
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { max: 1 });

try {
  const [dealer] = await sql`SELECT id FROM dealers WHERE slug = 'sabicars'`;
  if (!dealer) throw new Error("No Sabicars dealer row — run the legacy import first.");

  // Reuse the auth user if it already exists, so re-running is safe.
  let userId;
  const { data: created, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (!/already/i.test(error.message)) throw error;
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) throw new Error(`Could not find the existing auth user ${email}.`);
    userId = existing.id;
    console.log("Auth user already existed — reusing it.");
  } else {
    userId = created.user.id;
    console.log("Auth user created.");
  }

  await sql`
    INSERT INTO staff (id, dealer_id, email, full_name, phone, role, is_active)
    VALUES (${userId}, ${dealer.id}, ${email}, ${fullName}, ${phone}, ${role}, true)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone,
      role = EXCLUDED.role, is_active = true`;

  const [row] = await sql`SELECT email, role, is_active FROM staff WHERE id = ${userId}`;
  console.log(`\nStaff record ready: ${row.email} · ${row.role} · active ${row.is_active}\nSign in at /admin/login\n`);
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
