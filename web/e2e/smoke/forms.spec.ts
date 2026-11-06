import { expect, test } from "@playwright/test";
import { PARTNER_RULES } from "@/lib/referral";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The public forms, without writing a row to the live database.
 *
 * Two things are proved. First, each form refuses an empty submission with
 * the field errors a person would need. Second, the partner form's whole
 * round trip — browser to server action to database code and back — works:
 * it is sent exactly the way lib/leads.ts looksAutomated() recognises a bot
 * (the hidden "website" field filled in, and sent within three seconds of
 * the form being shown), and the server answers a bot with a convincing
 * fake: the code RECEIV, and nothing is saved. A real registration on the
 * live site would create a real partner; this one cannot.
 */
test.describe("Forms, without writing", () => {
  test("the partner programme page opens", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/partners");
    expect(response?.status(), "the partner programme page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the partner page shows no headline").toContainText("Send a buyer. Earn 1.5%.");
    await expect(page.getByRole("heading", { name: "A commission on sales. Nothing else." }), "the partner page no longer states the rules").toBeVisible();
    // The rules in full live here (the homepage keeps a hook and the three promises): what makes this a commission, never a scheme.
    for (const [rule] of PARTNER_RULES) {
      await expect(page.getByText(rule, { exact: true }).first(), `the partner rule "${rule}" is missing from the programme page`).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Register as a partner" }), "the partner page has no registration button").toBeVisible();
    assertNoFaults(faults);
  });

  test("the partner form refuses an empty registration", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/partners");
    await page.getByRole("button", { name: "Register as a partner" }).click();
    await expect(page.getByText("Please tell us your name"), "an empty registration was not told to give a name").toBeVisible();
    await expect(page.getByText("Tell us where you expect to find buyers"), "an empty registration was not told to choose where it finds buyers").toBeVisible();
    await expect(page.getByText("Please confirm you have read the programme rules"), "an empty registration was not told to accept the rules").toBeVisible();
    await expect(page.getByRole("status"), "an empty registration was accepted").toHaveCount(0);
    assertNoFaults(faults);
  });

  test("the partner form's round trip works, answering a bot with RECEIV and saving nothing", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/partners");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Register as a partner" }) });
    await form.getByLabel("Your name").fill("Smoke Test");
    await form.getByLabel("Phone number").fill("0803 000 0000");
    await form.getByLabel("Choose a 6-digit PIN").fill("482913");
    await form.getByLabel("Type the PIN again").fill("482913");
    await form.getByLabel("Where will you find buyers?").selectOption({ index: 1 });
    await form.getByRole("checkbox").check();
    // The trap: people never see this field; a bot fills it in. Submitting at once, within three seconds of
    // the form appearing, is the second signal. Either one makes looksAutomated() true, so nothing is saved.
    await form.locator('input[name="website"]').fill("https://example.com");
    await form.getByRole("button", { name: "Register as a partner" }).click();
    const welcome = page.getByRole("status");
    await expect(welcome, "the server did not answer the registration").toBeVisible();
    await expect(welcome, "the bot was not given the decoy code RECEIV — was a real partner created?").toContainText("RECEIV");
    await expect(welcome, "the welcome card does not read as a registration").toContainText(/You.re a Sabicars partner/);
    assertNoFaults(faults);
  });

  test("Log in is in the header, and the log-in page answers a bot like a wrong PIN, looking nothing up", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Log in", exact: true }), "the header has no Log in").toHaveAttribute("href", "/partner");
    await expect(header.locator('a[href^="tel:"]'), "the header still carries a call button").toHaveCount(0);

    await page.goto("/partner");
    await expect(page.getByRole("heading", { level: 1 }), "the log-in page shows no headline").toContainText("Log in to your partner page.");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Log in" }) });
    await expect(form.getByRole("link", { name: "Forgot your PIN?" }), "the log-in offers no way back from a forgotten PIN").toHaveAttribute("href", "/partner/forgot");
    // The trap, as above: the hidden field filled in, sent at once. The answer is a wrong guess's; nothing is looked up.
    await form.locator('input[name="website"]').fill("https://example.com");
    await form.getByLabel("Your phone number").fill("0803 000 0000");
    await form.getByLabel("Your 6-digit PIN").fill("482913");
    await form.getByRole("button", { name: "Log in" }).click();
    // Next.js keeps an empty alert of its own on every page (the route announcer): the one with the answer.
    await expect(page.getByRole("alert").filter({ hasText: "Wrong phone number or PIN." }), "the log-in page did not answer").toBeVisible();
    assertNoFaults(faults);
  });

  test("a phone marked logged in shows Account, and the log-in page clears a mark nobody is behind", async ({ page }) => {
    const faults = watchForFaults(page);
    const base = test.info().project.use.baseURL ?? "http://localhost:3000";
    // The readable flag the server sets beside a real session (lib/partner-session.ts). No session behind it here.
    await page.context().addCookies([{ name: "sc_signed_in", value: "1", url: base }]);
    await page.goto("/");
    const header = page.getByRole("banner");
    const account = header.getByRole("link", { name: "Account", exact: true });
    await expect(account, "a logged-in phone does not show Account").toBeVisible();
    await expect(account, "Account does not lead to the partner page").toHaveAttribute("href", "/partner");
    await expect(header.getByRole("link", { name: "Log in", exact: true }), "a logged-in phone still shows Log in").toHaveCount(0);

    // The server finds no session: the log-in shows, and the stale mark goes, so the header says Log in again.
    await page.goto("/partner");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in to your partner page.");
    await expect(header.getByRole("link", { name: "Log in", exact: true }), "a stale mark kept Account in the header").toBeVisible();
    assertNoFaults(faults);
  });

  test("the contact form refuses an empty message", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/contact");
    expect(response?.status(), "the contact page did not answer 200").toBe(200);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Please tell us your name"), "an empty message was not told to give a name").toBeVisible();
    await expect(page.getByText("Tell us a little about what you need"), "an empty message was not told to say what it is about").toBeVisible();
    await expect(page.getByRole("status"), "an empty message was accepted").toHaveCount(0);
    assertNoFaults(faults);
  });
});
