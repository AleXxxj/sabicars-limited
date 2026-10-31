import { expect, test } from "@playwright/test";
import { assertNoFaults, openFirstVehicle, stockCount, watchForFaults } from "../helpers";

/**
 * Reserving a car with a deposit: the page a buyer lands on from "Reserve
 * this car", with the car, the rules and the deposits on offer. Nothing is
 * sent — a submission would start a real payment.
 */
test.describe("Reserving a car", () => {
  test("offers the deposits the policy allows, in plain words", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const reserve = page.getByRole("link", { name: "Reserve this car" });
    test.skip((await reserve.count()) === 0, "The first car cannot be reserved online (no price, held elsewhere, or already held)");
    await reserve.click();
    await page.waitForURL(/\/reserve\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 }), "the reserve page does not name the car").not.toBeEmpty();
    // Said in the rules and again on the deposit itself, in the same words.
    await expect(page.getByText(/holds the car for one week/i).first(), "the page does not say what ₦500,000 holds").toBeVisible();
    await expect(page.getByText(/less 18%/), "the page does not state the refund charge").toBeVisible();
    const form = page.locator("form");
    const choices = form.getByRole("radio");
    if (await form.count()) {
      expect(await choices.count(), "the form offers no deposit").toBeGreaterThan(0);
      // The cheapest car in stock may cost under ₦500,000, when the only deposit is the whole price.
      await expect(form.getByText(/Least deposit|The full price/).first(), "the first deposit is not named").toBeVisible();
      await expect(form.getByLabel("Email, for your receipt"), "the form has no email field for the receipt").toBeVisible();
      await expect(form.getByRole("button", { name: /^(Pay ₦|Reserve with the team)/ }), "the form has no pay button").toBeVisible();
    } else {
      // Held, sold or reserved by phone: the page says which, and offers a way on.
      await expect(page.getByRole("heading", { level: 2 }), "a car that cannot be reserved online gets no explanation").toBeVisible();
    }
    assertNoFaults(faults);
  });

  test("the return page refuses a made-up reference", async ({ page }) => {
    const res = await page.goto("/reserve/done?reference=scr_notarealone1");
    expect(res?.status(), "a reference nobody paid should be a 404").toBe(404);
  });
});
