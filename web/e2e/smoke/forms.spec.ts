import { expect, test } from "@playwright/test";
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
