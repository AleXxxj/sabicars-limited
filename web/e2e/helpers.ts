import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

export { E2E, E2E_NAME_PREFIX, E2E_PHONES, E2E_SLUG_PREFIX, E2E_VEHICLES } from "./fixtures";

/**
 * Shared by both suites.
 *
 * `watchForFaults` fails a test on anything a visitor would experience as
 * broken even when the page itself renders: a server error on any request,
 * an uncaught exception in the browser, or a console error. Call it before
 * navigating; call `assertNoFaults` at the end.
 */
export interface FaultLog {
  serverErrors: string[];
  pageErrors: string[];
  consoleErrors: string[];
}

const IGNORED_CONSOLE = [/Download the React DevTools/, /third-party cookie/i, /favicon/i, /googletagmanager/i, /onesignal/i];

export function watchForFaults(page: Page): FaultLog {
  const log: FaultLog = { serverErrors: [], pageErrors: [], consoleErrors: [] };
  page.on("response", (res: Response) => {
    if (res.status() >= 500) log.serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  page.on("pageerror", (err) => log.pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) log.consoleErrors.push(msg.text());
  });
  return log;
}

export function assertNoFaults(log: FaultLog) {
  expect(log.serverErrors, "no request may answer with a server error").toEqual([]);
  expect(log.pageErrors, "no uncaught error in the browser").toEqual([]);
  expect(log.consoleErrors, "no console error").toEqual([]);
}

/** Today's date as the site prints it, in Lagos. */
export function lagosLongDate(d = new Date()): string {
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

/** Today as "YYYY-MM-DD" in Lagos: what a date field holds. */
export function lagosToday(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

/* ── Environment ──────────────────────────────────────────────────────── */

/**
 * `playwright test` does not read .env.local the way `node --env-file` does.
 * For a local run, the keys the flows suite needs (DATABASE_URL, and the
 * E2E_* ones if kept there) are read from it; anything the shell already set
 * wins. Values are never printed.
 */
export function loadLocalEnv(): void {
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

/** A staff sign-in for the flows suite; the credentials come from the environment and are never written down. */
export function staffCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_STAFF_EMAIL?.trim();
  const password = process.env.E2E_STAFF_PASSWORD;
  return email && password ? { email, password } : null;
}

/* ── The database (flows suite only) ──────────────────────────────────── */

export type Db = ReturnType<typeof postgres>;

/**
 * A connection to the throwaway database the flows suite asserts against and
 * cleans up in. It refuses a Supabase address: these tests write and delete
 * rows, and the live database is never the place for that.
 */
export function db(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. The flows suite needs the throwaway database that scripts/seed-e2e.mts seeded.");
  if (/supabase/i.test(url) && process.env.E2E_ALLOW_REMOTE !== "1") {
    throw new Error("DATABASE_URL points at Supabase. The flows suite creates and deletes rows: point it at a throwaway database (or set E2E_ALLOW_REMOTE=1 if that is really intended).");
  }
  return postgres(url, { max: 1, prepare: false });
}

/* ── Driving the site ─────────────────────────────────────────────────── */

/** lib/leads.ts looksAutomated(): a form sent within 3 s of being shown is treated as a bot. A person is slower. */
const HUMAN_FILL_MS = 3_500;

/**
 * Waits until the form has been on screen long enough for the server to
 * believe a person filled it in. Every public form carries a hidden
 * `renderedAt`; the server compares it with the moment of submission.
 */
export async function waitUntilFormLooksHuman(page: Page, form?: Locator): Promise<void> {
  const field = (form ?? page).locator('input[name="renderedAt"]').first();
  const shownAt = Number(await field.inputValue());
  const remaining = Number.isFinite(shownAt) && shownAt > 0 ? HUMAN_FILL_MS - (Date.now() - shownAt) : HUMAN_FILL_MS;
  if (remaining > 0) await page.waitForTimeout(remaining);
}

/** How many vehicles the inventory lists, from the "N vehicles in stock" sentence on /vehicles. Zero means the smoke tests that need a car should skip. */
export async function stockCount(page: Page): Promise<number> {
  await page.goto("/vehicles");
  const sentence = page.getByText(/\d+ vehicles? in stock/).first();
  await expect(sentence, "the inventory page shows no count of vehicles in stock").toBeVisible();
  return Number((await sentence.textContent())?.match(/(\d+) vehicles? in stock/)?.[1] ?? 0);
}

/** Opens the first car in the inventory the way a buyer would, by its card, and returns what the card called it. */
export async function openFirstVehicle(page: Page): Promise<{ title: string; slug: string }> {
  if (!page.url().endsWith("/vehicles")) await page.goto("/vehicles");
  const card = page.getByRole("article").first();
  await expect(card, "the inventory shows no vehicle card to open").toBeVisible();
  const link = card.getByRole("link").first();
  const title = (await link.getAttribute("aria-label")) ?? "";
  await link.click();
  await page.waitForURL(/\/vehicles\/[a-z0-9-]+(\?.*)?$/);
  const slug = new URL(page.url()).pathname.split("/").pop() ?? "";
  return { title, slug };
}

let staffSession: SupabaseClient | null = null;

/**
 * Signs the page in as the test member of staff without typing the password
 * into it.
 *
 * The repository is public, and a failed run uploads its report and traces,
 * which record everything typed into a page and every request the browser
 * makes. So the password is used here, in Node, through the same Supabase
 * library and cookie format the site itself uses (src/lib/supabase/server.ts),
 * and only the resulting session reaches the browser. A trace can still hold
 * that session, so `signOutStaff` revokes it when the suite ends: a copy in a
 * downloaded report is already dead. The form itself is covered by
 * e2e/flows/sign-in.spec.ts, with a wrong password.
 */
export async function signInAsStaff(page: Page): Promise<void> {
  const creds = staffCredentials();
  if (!creds) throw new Error("E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD are not set");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => {
        for (const { name, value } of toSet) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw new Error(`Supabase refused the test staff sign-in: ${error.message}`);
  staffSession = supabase;
  const base = test.info().project.use.baseURL ?? "http://localhost:3000";
  await page.context().addCookies([...jar].map(([name, value]) => ({ name, value, url: base })));
  await page.goto("/admin");
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.startsWith("/admin/login"), { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Sign out" }), "signed in, but the admin shows no Sign out button").toBeVisible();
}

/** Ends the test staff member's sessions everywhere, so one copied from a public report no longer works. */
export async function signOutStaff(): Promise<void> {
  if (!staffSession) return;
  const { error } = await staffSession.auth.signOut({ scope: "global" });
  if (error) console.warn(`Could not revoke the test staff session: ${error.message}`);
  staffSession = null;
}
