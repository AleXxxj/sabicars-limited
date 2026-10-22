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
      const cash = page.getByText("Cash purchase.", { exact: true });
      await expect(plan.or(cash).first(), 'the car page neither offers the Drive Plan nor says "Cash purchase."').toBeVisible();
      if (await plan.count()) {
        await expect(page.getByText("Estimated monthly repayment"), "the Drive Plan card shows no estimated monthly repayment").toBeVisible();
        await expect(page.getByText(/^\d+%, financed by Autochek$/), "the Drive Plan card does not say what Autochek finances").toBeVisible();
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
});
