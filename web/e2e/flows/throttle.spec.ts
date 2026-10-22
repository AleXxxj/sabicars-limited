import { createHmac } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { site } from "../../src/lib/site";
import { E2E, assertNoFaults, db, waitUntilFormLooksHuman, watchForFaults, type Db, type FaultLog } from "../helpers";

/**
 * The ceiling per connection (lib/rate-limit.ts), proved on the Refer & Earn
 * registration form, against the throwaway database scripts/seed-e2e.mts
 * filled:
 *
 *   1. Thirty registrations from one connection, each with its own phone
 *      number and each filled in at a person's pace, all go through; the
 *      thirty-first is turned away with the limit message, its details still
 *      in the form, and nothing is saved for it.
 *   2. A bot on that same connection still gets its decoy welcome, not the
 *      limit message (which would tell it it had been noticed), and is not
 *      counted against the people sharing the connection.
 *   3. Another connection is not held back by the first one's ceiling.
 *
 * Each "connection" is an address from 203.0.113.0/24, a range kept for
 * documentation that no real visitor has, sent as x-real-ip: the header
 * lib/rate-limit.ts reads first, which Vercel sets and `next start` passes
 * through untouched. So this suite never uses up the allowance of the
 * address the other suites share, and they never use up its.
 *
 * Every partner it registers is named "E2E Throttle …" (so `npm run e2e:seed
 * -- --clean` would find a stray one), and it removes its partners and its
 * rate_limits rows before and after.
 */

/** lib/rate-limit.ts LIMITS.partner: 30 registrations a connection in each ten-minute window. */
const LIMIT = 30;
const WINDOW_MS = 600_000;
/** How long the thirty-one registrations may take, at most. A run that would cross into the next window waits for it to begin. */
const RUN_BUDGET_MS = 90_000;
/** Forms opened at once: enough to be quick, few enough for a small CI runner. */
const BATCH = 8;

const FLOODED = "203.0.113.30";
const ELSEWHERE = "203.0.113.31";
const USER_AGENT = "sabicars-e2e (Playwright)";

/**
 * The key lib/rate-limit.ts stores for an address: an HMAC keyed with the same server secret the server
 * under test uses (RATE_LIMIT_SECRET, else CRON_SECRET — "e2e" in CI — else the local-development key).
 */
const keyFor = (address: string) =>
  createHmac("sha256", process.env.RATE_LIMIT_SECRET ?? process.env.CRON_SECRET ?? "sabicars-local-development")
    .update(address)
    .digest("hex")
    .slice(0, 32);

/** Partner n: a name the clean-up recognises, and a phone number nobody else in the suites uses. */
const nameFor = (n: number) => `E2E Throttle ${n}`;
const typedPhoneFor = (n: number) => `0803 001 ${String(n).padStart(4, "0")}`;
const phoneFor = (n: number) => `+2348030010${String(n).padStart(3, "0")}`;

const BOT = 90;
const OTHER = 91;
const ALL_PHONES = [...Array.from({ length: LIMIT + 1 }, (_, i) => phoneFor(i + 1)), phoneFor(BOT), phoneFor(OTHER)];

test.use({ extraHTTPHeaders: { "user-agent": USER_AGENT, "x-real-ip": FLOODED } });

let sql: Db;

async function removeEverythingThisSuiteCreates(): Promise<void> {
  await sql`delete from partners where phone = any(${ALL_PHONES}::text[]) or name like ${"E2E Throttle %"}`;
  await sql`delete from rate_limits where key_hash = any(${[keyFor(FLOODED), keyFor(ELSEWHERE)]}::text[])`;
}

/** Registrations counted for an address in the partner bucket, across every window this suite has touched. */
async function counted(address: string): Promise<number> {
  const [row] = await sql`select coalesce(sum(count), 0)::int as n from rate_limits where bucket = 'partner' and key_hash = ${keyFor(address)}`;
  return row.n as number;
}

async function partnersWithPhones(phones: string[]): Promise<number> {
  const [row] = await sql`select count(*)::int as n from partners where phone = any(${phones}::text[])`;
  return row.n as number;
}

/** Opens the registration form and fills it in as partner n would. */
async function filledForm(page: Page, n: number): Promise<Locator> {
  await page.goto("/partners");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Register as a partner" }) });
  await expect(form, "the partner registration form did not open").toBeVisible();
  await form.getByLabel("Your name").fill(nameFor(n));
  await form.getByLabel("Phone number").fill(typedPhoneFor(n));
  await form.getByLabel("Where will you find buyers?").selectOption({ label: "Friends and family" });
  await form.getByRole("checkbox").check();
  return form;
}

/** The welcome card a registration ends on, and the code it shows. */
async function welcomeCode(page: Page, what: string): Promise<string> {
  const welcome = page.getByRole("status").filter({ hasText: /Sabicars partner/ });
  await expect(welcome, `${what} was not welcomed`).toContainText("You’re a Sabicars partner, E2E.");
  return (await welcome.innerText()).match(/\/r\/([A-Z0-9]{6})\b/)?.[1] ?? "";
}

async function expectRegistered(page: Page, n: number): Promise<void> {
  const code = await welcomeCode(page, `registration ${n}`);
  expect(code, `registration ${n} shows no six-character partner code`).toMatch(/^[A-Z0-9]{6}$/);
  expect(code, `registration ${n} was taken for a bot and saved nothing`).not.toBe("RECEIV");
}

test.beforeAll(async ({ playwright }) => {
  sql = db();
  // The server must be reading the database this suite asserts against, never another one and never the
  // live one: the seeded car is the proof. Checked before a single form is sent.
  const base = test.info().project.use.baseURL ?? "http://localhost:3000";
  const api = await playwright.request.newContext({ baseURL: base });
  try {
    const status = (await api.get(`/vehicles/${E2E.vehicles.hummer.slug}`)).status();
    if (status !== 200) {
      throw new Error(
        `${base} answered ${status} for the seeded car, so it is not reading the database this suite seeded (DATABASE_URL). Nothing was written. ` +
          "Start the server with the same DATABASE_URL as the seed, then run again.",
      );
    }
  } finally {
    await api.dispose();
  }
  // A run that died half-way leaves its rows behind; start from nothing.
  await removeEverythingThisSuiteCreates();
});

test.afterAll(async () => {
  if (!sql) return;
  await removeEverythingThisSuiteCreates();
  await sql.end();
});

test.describe("A ceiling per connection on partner registration", () => {
  test.describe.configure({ mode: "serial" });

  test(`the first ${LIMIT} registrations from one connection go through and the next is turned away`, async ({ context }) => {
    test.setTimeout(2 * RUN_BUDGET_MS + 60_000);

    // The count lives in fixed ten-minute windows. A run that crossed into the next one would start counting
    // again from zero and prove nothing, so it waits for a fresh window when this one is nearly over.
    const windowOf = (t: number) => Math.floor(t / WINDOW_MS);
    const left = WINDOW_MS - (Date.now() % WINDOW_MS);
    if (left < RUN_BUDGET_MS) await new Promise((r) => setTimeout(r, left + 1_000));
    const startedAt = Date.now();

    const faults: FaultLog[] = [];
    const total = LIMIT + 1;
    for (let first = 1; first <= total; first += BATCH) {
      const numbers = Array.from({ length: Math.min(BATCH, total - first + 1) }, (_, i) => first + i);
      // A batch of forms is opened and filled at once; each is then given a person's time before it is sent.
      const opened = await Promise.all(
        numbers.map(async (n) => {
          const page = await context.newPage();
          faults.push(watchForFaults(page));
          return { n, page, form: await filledForm(page, n) };
        }),
      );
      for (const { n, page, form } of opened) {
        await waitUntilFormLooksHuman(page, form);
        if (n > LIMIT && windowOf(Date.now()) !== windowOf(startedAt)) {
          throw new Error(`The registrations took ${Math.round((Date.now() - startedAt) / 1000)} s and crossed into a new ten-minute window, where the count starts again. Raise RUN_BUDGET_MS and run again.`);
        }
        await form.getByRole("button", { name: "Register as a partner" }).click();
        if (n <= LIMIT) {
          await expectRegistered(page, n);
          continue;
        }
        const alert = form.getByRole("alert");
        await expect(alert, `registration ${n} was not turned away`).toContainText("Too many requests from your connection");
        await expect(alert, "the limit message gives no number to call").toContainText(site.phones[0].display);
        await expect(form.getByLabel("Your name"), "the turned-away form lost what was typed").toHaveValue(nameFor(n));
        await expect(form.getByLabel("Phone number"), "the turned-away form lost what was typed").toHaveValue(typedPhoneFor(n));
      }
      await Promise.all(opened.map(({ page }) => page.close()));
    }
    console.log(`[throttle] ${total} registrations sent in ${Math.round((Date.now() - startedAt) / 1000)} s`);

    expect(await partnersWithPhones(ALL_PHONES.slice(0, LIMIT)), `the first ${LIMIT} registrations are not all on record`).toBe(LIMIT);
    expect(await partnersWithPhones([phoneFor(total)]), "the turned-away registration was saved anyway").toBe(0);
    expect(await counted(FLOODED), "every real attempt, the turned-away one included, should be counted once").toBe(total);
    for (const log of faults) assertNoFaults(log);
  });

  test("a bot on the same connection still gets its decoy, and is not counted", async ({ page }) => {
    const faults = watchForFaults(page);
    const before = await counted(FLOODED);
    expect(before, "the first test did not leave the connection at its ceiling").toBeGreaterThan(LIMIT);

    const form = await filledForm(page, BOT);
    // The hidden field only a bot fills in. The form is otherwise sent at a person's pace, so the field alone gives it away.
    await form.locator('input[name="website"]').fill("https://example.com", { force: true });
    await waitUntilFormLooksHuman(page, form);
    await form.getByRole("button", { name: "Register as a partner" }).click();

    expect(await welcomeCode(page, "the bot"), "the bot was not given the decoy code").toBe("RECEIV");
    await expect(page.getByText("Too many requests from your connection"), "the bot was shown the limit message, which tells it it was noticed").toHaveCount(0);
    expect(await counted(FLOODED), "the bot was counted against the people sharing its connection").toBe(before);
    expect(await partnersWithPhones([phoneFor(BOT)]), "the bot's registration was saved").toBe(0);
    assertNoFaults(faults);
  });

  test("another connection is not held back by the first one's ceiling", async ({ browser }) => {
    const elsewhere = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      extraHTTPHeaders: { "user-agent": USER_AGENT, "x-real-ip": ELSEWHERE },
    });
    try {
      const page = await elsewhere.newPage();
      const faults = watchForFaults(page);
      const form = await filledForm(page, OTHER);
      await waitUntilFormLooksHuman(page, form);
      await form.getByRole("button", { name: "Register as a partner" }).click();
      await expectRegistered(page, OTHER);
      expect(await partnersWithPhones([phoneFor(OTHER)]), "the registration from the other connection is not on record").toBe(1);
      expect(await counted(ELSEWHERE), "the other connection should have a count of its own").toBe(1);
      assertNoFaults(faults);
    } finally {
      await elsewhere.close();
    }
  });
});
