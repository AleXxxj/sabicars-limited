import { expect, test } from "@playwright/test";
import { assertNoFaults, openFirstVehicle, stockCount, watchForFaults } from "../helpers";

/**
 * A car's page, opened from its card the way a buyer opens it: the name and
 * the price, how it can be paid for, a photograph that really loaded, and
 * the enquiry and viewing forms.
 */
test.describe("A car's page", () => {
  test("shows the car's title and price", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    const { title } = await openFirstVehicle(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading, "the car page shows no title").not.toBeEmpty();
    // The card named it "2016 Toyota Hiace, ₦…"; the page's heading is the model.
    const model = (await heading.innerText()).trim();
    expect(title, `the card said "${title}" but the page is about "${model}"`).toContain(model);
    await expect(page.getByText("Price", { exact: true }).first(), "the car page has no Price label").toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).first(), "the car page shows no price").toBeVisible();
    assertNoFaults(faults);
  });

  test("says how the car can be paid for", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const price = (await page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).first().innerText()).trim();
    const status = page.getByText(/This vehicle has been sold|Reserved — a buyer has placed a deposit/);
    if (price === "Price on request") {
      // No price, no plan: the enquiry form is the way to ask.
      await expect(page.getByRole("link", { name: "Enquire about this vehicle" }), "a car on request offers no way to enquire").toBeVisible();
    } else if (await status.count()) {
      await expect(status, "the car's status note is not shown").toBeVisible();
    } else {
      const plan = page.getByText(/^Your \d+% deposit$/);
      const cash = page.getByText("Full payment only.", { exact: true });
      await expect(plan.or(cash).first(), 'the car page neither offers the Drive Plan nor says "Full payment only."').toBeVisible();
      if (await plan.count()) {
        await expect(page.getByText(/^\d+%, paid by a loan through Autochek$/), "the Drive Plan card does not say what the loan covers").toBeVisible();
        // The estimate is folded away under "Monthly estimate", so the price stays the first thing read.
        await page.locator("summary").filter({ hasText: "Monthly estimate" }).first().click();
        await expect(page.getByText("Estimated monthly repayment"), "the Drive Plan card shows no estimated monthly repayment").toBeVisible();
      }
    }
    assertNoFaults(faults);
  });

  test("has a photograph that really loaded", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // The gallery's main image is the first photograph on the page; a placeholder counts, a broken image does not.
    const photo = page.getByRole("img", { name: /for sale in Lagos|photos coming soon/ }).first();
    await expect(photo, "the car page shows no photograph").toBeVisible();
    await expect
      .poll(async () => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth), { message: "the car's photograph never loaded (naturalWidth stayed 0)", timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(page.getByText(/^1 \/ \d+$/).first(), "the gallery does not count its photos").toBeVisible();
    assertNoFaults(faults);
  });

  test("offers an enquiry and a viewing", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    await expect(page.getByRole("heading", { name: /^Interested in the / }), "the car page has no enquiry section").toBeVisible();
    await expect(page.getByRole("button", { name: "Send enquiry" }), "the enquiry form has no Send enquiry button").toBeVisible();
    await expect(page.getByRole("link", { name: "Book a viewing" }).first(), "the car page offers no viewing").toBeVisible();
    await expect(page.getByRole("link", { name: "Enquire about this vehicle" }), "the car page has no Enquire button").toHaveAttribute("href", "#enquire");
    assertNoFaults(faults);
  });

  test("reaches a person in one tap, and calls back from a number alone", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // The four facts a buyer reads first sit under the name, before the price.
    await expect(page.getByRole("heading", { level: 1 }), "the car page shows no name").toBeVisible();
    await expect(page.getByText(/Foreign used|Nigerian used|Brand new/).first(), "the car page does not state the car's condition up top").toBeVisible();
    // One tap to a phone: a tel: link on the page.
    await expect(page.locator('a[href^="tel:"]').first(), "the car page has no call link").toBeAttached();
    // Call me back: one field. Sent the way looksAutomated() recognises a bot, so the server answers with
    // the decoy and writes nothing — a real number here would ring the showroom.
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Call me back" }) });
    await expect(form, "the car page has no Call me back form").toBeAttached();
    await form.locator('input[name="phone"]').fill("0803 000 0000");
    await form.locator('input[name="website"]').fill("https://example.com");
    await form.getByRole("button", { name: "Call me back" }).click();
    const done = page.getByRole("status").filter({ hasText: /We will call/ });
    await expect(done, "the call-back did not answer").toBeVisible();
    await expect(done, "the bot was not given the decoy reference — was a real call-back saved?").toContainText("RECEIVED");
    assertNoFaults(faults);
  });
});
