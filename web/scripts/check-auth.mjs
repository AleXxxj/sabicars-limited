#!/usr/bin/env node
/**
 * Checks the Supabase configuration without ever printing a key.
 *
 *   npm run auth:check
 *
 * Verifies, in order:
 *  1. the three variables are set, and look like the right kind of key;
 *  2. the project answers with the public key;
 *  3. public sign-up is DISABLED — staff accounts are created only by an owner
 *     (scripts/create-staff.mjs). With sign-up open, anyone could create an
 *     account; requireStaff() would still refuse them, but a closed door beats a
 *     second lock;
 *  4. the secret key has admin rights (it can list users).
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let failed = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => (failed++, console.log(`  \x1b[31m✗\x1b[0m ${m}`));
/** Describe a key by its kind and length only — never its value. */
const shape = (k) => (k ? `${k.startsWith("sb_") ? k.split("_").slice(0, 2).join("_") + "_…" : k.startsWith("eyJ") ? "JWT" : "unrecognised format"}, ${k.length} chars` : "missing");

console.log("\nSupabase configuration");

if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) bad(`NEXT_PUBLIC_SUPABASE_URL should look like https://<ref>.supabase.co (got ${url ? "something else" : "nothing"})`);
else ok(`project URL set (${url.replace(/^https:\/\/([a-z0-9]{4})[a-z0-9]*/, "https://$1…")})`);

if (!publicKey) bad("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing — use the publishable key (sb_publishable_…) or the legacy anon key");
else if (publicKey.startsWith("sb_secret_")) bad("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a SECRET key — that would be sent to every visitor's browser. Use the publishable key.");
else ok(`public key set (${shape(publicKey)})`);

if (!secretKey) bad("SUPABASE_SERVICE_ROLE_KEY is missing — use a secret key (sb_secret_…) or the legacy service_role key");
else if (secretKey === publicKey || secretKey.startsWith("sb_publishable_")) bad("SUPABASE_SERVICE_ROLE_KEY holds the PUBLIC key — it needs the secret key");
else ok(`secret key set (${shape(secretKey)})`);

if (failed) {
  console.log(`\n${failed} problem(s) — fix web/.env.local and run again.\n`);
  process.exit(1);
}

// 2 + 3. The project answers, and says whether sign-up is open.
try {
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: publicKey } });
  if (!res.ok) {
    bad(`project did not accept the public key (HTTP ${res.status})`);
  } else {
    ok("project reachable with the public key");
    const settings = await res.json();
    if (settings.disable_signup === true) ok("public sign-up is disabled");
    else bad("public sign-up is OPEN — turn off “Allow new users to sign up” (Authentication → Sign In / Providers)");
    if (settings.external?.email === false) bad("email sign-in is switched off — staff sign in with email and password");
    else ok("email and password sign-in is enabled");
  }
} catch (e) {
  bad(`could not reach the project: ${e.message}`);
}

// 4. The secret key really has admin rights.
try {
  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.listUsers({ perPage: 1 });
  if (error) bad(`secret key was refused for admin use: ${error.message}`);
  else ok("secret key has admin rights");
} catch (e) {
  bad(`admin check failed: ${e.message}`);
}

console.log(failed ? `\n${failed} problem(s) to fix.\n` : "\nSupabase is configured correctly.\n");
process.exit(failed ? 1 : 0);
