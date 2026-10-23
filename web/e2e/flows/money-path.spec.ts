import { expect, test } from "@playwright/test";
import {
  E2E,
  assertNoFaults,
  db,
  lagosLongDate,
  lagosToday,
  signInAsStaff,
  signOutStaff,
  staffCredentials,
  waitUntilFormLooksHuman,
  watchForFaults,
  type Db,
} from "../helpers";

/**
 * The money path, end to end, against the throwaway database that
 * scripts/seed-e2e.mts filled:
 *
 *   1. A buyer enquires about the seeded 2013 Hiace Hummer, and the enquiry
 *      is on record with the reference they were shown.
 *   2. A partner registers, opens the private page from their welcome card,
 *      and registers the bank account they are paid into.
 *   3. Staff (when E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD are set) sell the
 *      car, attribute the sale to the partner's code, confirm the bank
 *      account, record the bank transfer once the cooling-off has passed,
 *      and the partner's page says "Paid" with the bank's reference.
 *
 * The database is read after every step, so a page that merely looks right
 * cannot pass. Every row the suite creates is removed afterwards, and the
 * car is put back on sale.
 *
 * Assumes no PAYSTACK_SECRET_KEY on the server: the account is then saved
 * for a manager to confirm, which is the path this suite walks.
 */

const hummer = E2E.vehicles.hummer;
const hummerTitle = `${hummer.year} ${hummer.make} ${hummer.model}`;

let sql: Db;
let vehicleId: string;

/** Removes what this suite creates — children before parents — and puts the car back on sale. Safe to run before and after. */
async function removeEverythingThisSuiteCreates(): Promise<void> {
  await sql.begin(async (tx) => {
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    const partnerIds = ids(await tx`select id from partners where phone = ${E2E.partner.phone} or name = ${E2E.partner.name}`);
    const commissionIds = ids(await tx`select id from commissions where vehicle_id = ${vehicleId} or partner_id = any(${partnerIds}::uuid[])`);
    const payoutIds = ids(await tx`select id from payouts where commission_id = any(${commissionIds}::uuid[]) or partner_id = any(${partnerIds}::uuid[])`);
    const leadIds = ids(await tx`select id from leads where vehicle_id = ${vehicleId} or partner_id = any(${partnerIds}::uuid[]) or phone = any(${[E2E.buyer.phone, E2E.partner.phone]}::text[])`);
    await tx`delete from payouts where id = any(${payoutIds}::uuid[])`;
    await tx`delete from commissions where id = any(${commissionIds}::uuid[])`;
    await tx`delete from leads where id = any(${leadIds}::uuid[])`;
    await tx`delete from partners where id = any(${partnerIds}::uuid[])`;
    await tx`update vehicles set status = 'available', sold_at = null, sold_price_minor = null, updated_at = now() where id = ${vehicleId}`;
    await tx`delete from audit_log where entity_id = any(${[vehicleId, ...partnerIds, ...commissionIds, ...payoutIds, ...leadIds]}::text[])`;
  });
}

test.beforeAll(async ({ playwright }) => {
  sql = db();
  const [car] = await sql`select id, status from vehicles where slug = ${hummer.slug}`;
  if (!car) throw new Error(`The seeded car ${hummer.slug} is missing. Run npm run e2e:seed against this database first.`);
  vehicleId = car.id;

  // The server must be reading the same database this suite seeded and asserts against — never
  // another one, and never the live one. `next start` loads .env.production.local ahead of .env.local,
  // so a machine that kept the live DATABASE_URL there would quietly serve the live site (the live
  // URL is kept in web/.env.live for exactly this reason, a name Next.js never loads); the seeded car
  // is the proof of which database answers. Checked before a single form is sent.
  const base = test.info().project.use.baseURL ?? "http://localhost:3000";
  const api = await playwright.request.newContext({ baseURL: base });
  try {
    const status = (await api.get(`/vehicles/${hummer.slug}`)).status();
    if (status !== 200) {
      throw new Error(
        `${base} answered ${status} for the seeded car /vehicles/${hummer.slug}, so it is not reading the database this suite seeded (DATABASE_URL). ` +
          "Nothing was written. Start the server with the same DATABASE_URL as the seed (e.g. DATABASE_URL=… npx next start), then run again.",
      );
    }
  } finally {
    await api.dispose();
  }

  // A run that died half-way leaves its rows behind; start from nothing.
  await removeEverythingThisSuiteCreates();
});

test.afterAll(async () => {
  await signOutStaff();
  if (!sql) return;
  if (vehicleId) await removeEverythingThisSuiteCreates();
  await sql.end();
});

/** The partner the registration test created, as the database holds them. */
async function seededPartner(): Promise<{ id: string; code: string; access_token: string }> {
  const [partner] = await sql`select id, code, access_token from partners where phone = ${E2E.partner.phone}`;
  if (!partner) throw new Error("The partner from the registration test is missing.");
  return partner as { id: string; code: string; access_token: string };
}

/* ── 1. A buyer enquires ───────────────────────────────────────────────── */

test("a buyer's enquiry on a car is saved under the reference they were shown", async ({ page }) => {
  const faults = watchForFaults(page);
  await page.goto(`/vehicles/${hummer.slug}`);
  await expect(page.getByRole("heading", { level: 1 }), "the seeded car's page did not open").toHaveText(hummer.model);
  await expect(page.getByText("₦24,000,000").first(), "the car page does not show the seeded price").toBeVisible();

  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send enquiry" }) });
  await form.getByLabel("Your name").fill(E2E.buyer.name);
  await form.getByLabel("Phone number").fill(E2E.buyer.typedPhone);
  await form.getByLabel(/^Your question/).fill("Is it still available, and can I bring my mechanic on Saturday?");
  await waitUntilFormLooksHuman(page, form);
  await form.getByRole("button", { name: "Send enquiry" }).click();

  const confirmation = page.getByRole("status").filter({ hasText: "Enquiry received" });
  await expect(confirmation, "the enquiry was not confirmed on screen").toBeVisible();
  await expect(confirmation, "the confirmation does not greet the buyer by first name").toContainText("Thank you, E2E.");
  const reference = (await confirmation.innerText()).match(/\bSC-[A-Z0-9]{6,8}\b/)?.[0] ?? "";
  expect(reference, "the confirmation shows no reference").toMatch(/^SC-[A-Z0-9]{6}$/);
  expect(reference, "the server took the enquiry for a bot and saved nothing").not.toBe("SC-RECEIVED");
  await expect(confirmation.getByRole("link", { name: /Continue on WhatsApp/ }), "the WhatsApp link does not carry the reference").toHaveAttribute("href", new RegExp(reference));

  const [lead] = await sql`select id, name, type, status, channel, vehicle_id, preferred_contact from leads where phone = ${E2E.buyer.phone} order by created_at desc limit 1`;
  expect(lead, "no enquiry row was saved for the buyer's phone number").toBeTruthy();
  expect(lead.vehicle_id, "the enquiry is not attached to the car it was made on").toBe(vehicleId);
  expect(lead.name).toBe(E2E.buyer.name);
  expect(lead.type).toBe("question");
  expect(lead.channel).toBe("web_form");
  expect(lead.status, "a new enquiry should wait as 'new'").toBe("new");
  expect(lead.preferred_contact).toBe("phone");
  expect(`SC-${String(lead.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`, "the reference shown does not point at the row saved").toBe(reference);
  assertNoFaults(faults);
});

/* ── 2. A partner registers · 3. Staff pay the commission ─────────────── */

test.describe("Refer & Earn, from registration to payment", () => {
  test.describe.configure({ mode: "serial" });

  test("a partner registers, opens their private page and registers their bank account", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/partners");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Register as a partner" }) });
    await form.getByLabel("Your name").fill(E2E.partner.name);
    await form.getByLabel("Phone number").fill(E2E.partner.typedPhone);
    await form.getByLabel("Where will you find buyers?").selectOption({ label: "Friends and family" });
    await form.getByRole("checkbox").check();
    await waitUntilFormLooksHuman(page, form);
    await form.getByRole("button", { name: "Register as a partner" }).click();

    const welcome = page.getByRole("status").filter({ hasText: /Sabicars partner/ });
    await expect(welcome, "the registration was not welcomed").toContainText("You’re a Sabicars partner, E2E.");
    const card = await welcome.innerText();
    const code = card.match(/\/r\/([A-Z0-9]{6})\b/)?.[1] ?? "";
    expect(code, "the welcome card shows no six-character partner code").toMatch(/^[A-Z0-9]{6}$/);
    expect(code, "the server took the registration for a bot and saved nothing").not.toBe("RECEIV");
    const token = card.match(/\/partner\/([0-9a-f-]{36})\b/i)?.[1] ?? "";
    expect(token, "the welcome card shows no private page link").toMatch(/^[0-9a-f-]{36}$/i);
    await expect(welcome.getByRole("link", { name: "Open your page" }), "the welcome card's button does not open the private page").toHaveAttribute("href", new RegExp(`/partner/${token}$`));

    const [partner] = await sql`select id, code, access_token, status, reach, email from partners where phone = ${E2E.partner.phone}`;
    expect(partner, "no partner row was saved for the phone number").toBeTruthy();
    expect(partner.code, "the code on screen is not the code on record").toBe(code);
    expect(partner.access_token, "the private link on screen is not the token on record").toBe(token);
    expect(partner.status).toBe("active");
    expect(partner.reach).toBe("Friends and family");

    // Their private page, opened by its path so the test does not depend on the public address the site thinks it has.
    await page.goto(`/partner/${token}`);
    await expect(page.getByRole("heading", { level: 1 }), "the private page does not greet the partner").toHaveText("Hello, E2E.");
    await expect(page.getByText(new RegExp(`Your partner code is ${code}`)), "the private page does not show the partner's code").toBeVisible();
    await expect(page.getByText(/^No sales yet\./), "a new partner's page should show no sales yet").toBeVisible();

    // The bank form's controls by name (components/partner/BankAccountForm.tsx): a <select> inside its
    // <label> takes the chosen option into its accessible name, so a label lookup is not stable.
    await page.locator('select[name="bankCode"]').selectOption({ label: E2E.bank.name });
    await page.locator('input[name="accountNumber"]').fill(E2E.bank.accountNumber);
    await page.getByRole("button", { name: "Save account" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." }), "the bank account was not saved").toContainText(
      "Saved. Sabicars will confirm the account before your first payout.",
    );
    await expect(page.getByText(E2E.bank.masked), "the saved account is not shown masked to its last four digits").toBeVisible();
    await expect(page.getByText("Not verified yet: Sabicars confirms it before your first payout."), "the page does not say the account awaits confirmation").toBeVisible();
    await expect(page.getByText(E2E.bank.accountNumber), "the full account number must never be shown back").toHaveCount(0);

    const [account] = await sql`select bank_code, bank_name, account_number, account_name, account_verified_at, paystack_recipient_code from partners where id = ${partner.id}`;
    expect(account.bank_code, "the bank code saved is not Guaranty Trust Bank's").toBe(E2E.bank.code);
    expect(account.bank_name).toBe(E2E.bank.name);
    expect(account.account_number).toBe(E2E.bank.accountNumber);
    expect(account.account_verified_at, "an account nobody has checked must not be verified").toBeNull();
    expect(account.paystack_recipient_code).toBeNull();
    assertNoFaults(faults);
  });

  test("staff sell the car, attribute it, confirm the account, pay the commission, and the partner sees it paid", async ({ page }) => {
    test.skip(!staffCredentials(), "E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD not set");
    const faults = watchForFaults(page);
    const partner = await seededPartner();
    await signInAsStaff(page);

    // The sale: status sold, and what the buyer actually paid.
    await page.goto(`/admin/vehicles/${vehicleId}`);
    await expect(page.getByRole("heading", { level: 1 }), "the admin did not open the seeded car").toHaveText(hummerTitle);
    // The vehicle form's fields by name (components/admin/VehicleForm.tsx: a status <select>, a soldPrice input).
    await page.locator('select[name="status"]').selectOption("sold");
    await page.locator('input[name="soldPrice"]').fill(E2E.sale.typedPrice);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved — the website is up to date"), "the sale was not saved").toBeVisible();
    const [sold] = await sql`select status, sold_price_minor, sold_at from vehicles where id = ${vehicleId}`;
    expect(sold.status, "the car is not recorded as sold").toBe("sold");
    expect(Number(sold.sold_price_minor), "the sale price on record is not ₦24,000,000").toBe(E2E.sale.priceMinor);
    expect(sold.sold_at, "a sold car must carry the date it sold").not.toBeNull();

    // The attribution: the buyer gave the partner's code at the showroom.
    await page.reload();
    const commissionPanel = page.getByRole("region", { name: "Partner commission" });
    await expect(commissionPanel.getByText("No partner is on record for this sale."), "the sold car does not offer to attribute the sale").toBeVisible();
    await commissionPanel.locator('input[name="code"]').fill(partner.code);
    await commissionPanel.getByRole("button", { name: "Attribute" }).click();
    await expect(commissionPanel, "the attribution did not record ₦360,000 for the partner").toContainText(
      `${E2E.sale.commissionLabel} recorded for ${E2E.partner.name} (${partner.code})`,
    );
    await page.reload();
    await expect(commissionPanel, "the Partner commission section does not show ₦360,000").toContainText(E2E.sale.commissionLabel);
    await expect(commissionPanel, "the commission is not explained as 1.5% of the sale").toContainText("1.5% of ₦24,000,000");
    await expect(commissionPanel, "the commission does not say it is in its cooling-off").toContainText("In its cooling-off until");
    const [commission] = await sql`select id, partner_id, amount_minor, sale_price_minor, rate_bps, status, source, payable_at from commissions where vehicle_id = ${vehicleId} and status <> 'void'`;
    expect(commission, "no commission row was written").toBeTruthy();
    expect(commission.partner_id, "the commission is owed to the wrong partner").toBe(partner.id);
    expect(Number(commission.amount_minor), "the commission is not 1.5% of ₦24,000,000").toBe(E2E.sale.commissionMinor);
    expect(Number(commission.sale_price_minor)).toBe(E2E.sale.priceMinor);
    expect(commission.rate_bps).toBe(150);
    expect(commission.source).toBe("manual");
    expect(commission.status).toBe("pending");
    expect(new Date(commission.payable_at).getTime(), "the commission must wait out its cooling-off").toBeGreaterThan(Date.now());

    // The bank account, confirmed by a manager as the partner's own.
    await page.goto(`/admin/partners/${partner.id}`);
    await expect(page.getByRole("heading", { level: 1 }), "the admin did not open the partner").toHaveText(E2E.partner.name);
    const bank = page.getByRole("region", { name: "Bank account" });
    await expect(bank, "the partner's page does not show the registered account").toContainText(`${E2E.bank.name}`);
    await expect(bank).toContainText(E2E.bank.masked);
    await bank.getByRole("button", { name: "Confirm the account" }).click();
    await bank.getByRole("button", { name: "Yes, it is in their name" }).click();
    await expect(bank.getByText("Confirmed. The account can now be paid."), "the account was not confirmed").toBeVisible();
    await page.reload();
    await expect(bank, "the partner's page does not show the account as verified").toContainText(`Verified on ${lagosLongDate()}`);
    const [verified] = await sql`select account_verified_at, account_verified_by from partners where id = ${partner.id}`;
    expect(verified.account_verified_at, "the verification is not on record").not.toBeNull();
    expect(verified.account_verified_by, "a hand confirmation must name the manager").toBeTruthy();

    // Two days pass: the cooling-off, moved by the clock in the database rather than by waiting.
    await sql`update commissions set payable_at = now() - interval '1 hour' where id = ${commission.id}`;

    // The payout, recorded as a bank transfer with the bank's reference.
    await page.goto("/admin/payouts");
    await expect(page.getByRole("heading", { name: /^Ready to pay/ }), "the payouts page does not list the commission as ready to pay").toHaveText(/Ready to pay\s*1/);
    const row = page.locator(`[id="commission-${commission.id}"]`);
    await expect(row, "the ready-to-pay row is missing").toContainText(E2E.partner.name);
    await expect(row).toContainText(E2E.sale.commissionLabel);
    await expect(row, "the row does not show the account as verified").toContainText("verified");
    await row.getByRole("button", { name: "Record a bank transfer" }).click();
    await row.locator('input[name="bankReference"]').fill(E2E.bankReference);
    await row.locator('input[name="paidOn"]').fill(lagosToday());
    await row.locator('input[name="note"]').fill("End-to-end test transfer");
    await row.getByRole("button", { name: "Continue" }).click();
    await expect(row, "the transfer was not read back before recording").toContainText(`Record ${E2E.sale.commissionLabel} paid to ${E2E.bank.name} ${E2E.bank.masked}`);
    await expect(row).toContainText(E2E.bankReference);
    await row.getByRole("button", { name: "Record it" }).click();
    await expect(row.getByText("Recorded as paid."), "the transfer was not recorded").toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /^Ready to pay/ }), "the commission is still listed as ready to pay").toHaveText(/Ready to pay\s*0/);
    const paid = page.locator("li").filter({ hasText: E2E.bankReference }).first();
    await expect(paid, "the payment is not listed under Paid").toBeVisible();
    await expect(paid).toContainText(E2E.partner.name);
    await expect(paid).toContainText(E2E.sale.commissionLabel);
    await expect(paid).toContainText("Bank transfer");
    const [payout] = await sql`select status, method, bank_reference, amount_minor, reference, bank_name, account_number, paid_at from payouts where commission_id = ${commission.id}`;
    expect(payout, "no payout row was written").toBeTruthy();
    expect(payout.status).toBe("paid");
    expect(payout.method).toBe("bank_transfer");
    expect(payout.bank_reference).toBe(E2E.bankReference);
    expect(Number(payout.amount_minor)).toBe(E2E.sale.commissionMinor);
    expect(payout.reference, "the payout reference is not in Sabicars' own shape").toMatch(/^scp_[a-z0-9]{8}_[a-z0-9]{8}$/);
    expect(payout.bank_name, "the payout does not record the account it went to").toBe(E2E.bank.name);
    expect(payout.account_number).toBe(E2E.bank.accountNumber);
    expect(payout.paid_at).not.toBeNull();
    const [settled] = await sql`select status, paid_at from commissions where id = ${commission.id}`;
    expect(settled.status, "the commission was not marked paid").toBe("paid");
    expect(settled.paid_at).not.toBeNull();

    // What the partner sees.
    await page.goto(`/partner/${partner.access_token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, E2E.");
    await expect(page.getByRole("cell", { name: new RegExp(`^Paid ${lagosLongDate()}$`) }), "the partner's page does not show the commission as paid today").toBeVisible();
    await expect(page.getByText(`Bank ref. ${E2E.bankReference}`), "the partner's page does not show the bank's reference").toBeVisible();
    await expect(page.getByText("Bank transfer", { exact: true }), "the partner's page does not show the payment as a bank transfer").toBeVisible();
    const paidFigure = page.locator("dd").filter({ hasText: E2E.sale.commissionLabel });
    await expect(paidFigure.first(), "the partner's earnings do not show ₦360,000").toBeVisible();
    assertNoFaults(faults);
  });
});
