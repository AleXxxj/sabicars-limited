import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The 40% Drive Plan page: the finder answers "what can I put down?" from
 * live stock as the buyer types, and the price split shows the deposit tier
 * for the car's model year.
 */
test.describe("The Drive Plan page", () => {
  test("opens and explains the plan", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/drive-plan");
    expect(response?.status(), "the Drive Plan page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the Drive Plan page shows no headline").toContainText(/Autochek finances the rest/);
    await expect(page.getByRole("heading", { name: "Four steps from choosing to driving." }), "the page no longer explains the four steps").toBeVisible();
    assertNoFaults(faults);
  });

  test("the finder answers a deposit typed in", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/drive-plan");
    const input = page.getByLabel("I can put down");
    test.skip((await input.count()) === 0, "No car in stock can go on the Drive Plan, so the finder is not shown");
    const result = page.locator('[aria-live="polite"]').filter({ hasText: /deposit/ }).first();
    await expect(result, "the finder shows no answer for the starting amount").toBeVisible();
    const before = (await result.innerText()).trim();

    await input.fill("5000000");
    await expect(input, "the finder did not keep the amount typed").toHaveValue("5,000,000");
    // ₦5,000,000 down reaches ₦12,500,000 at 40%; if nothing in stock is within reach the finder says so instead.
    await expect(result, "the finder's answer did not change for ₦5,000,000").not.toHaveText(before);
    await expect(result, "the finder neither states the ₦12,500,000 reach nor says nothing is within it").toContainText(/₦12,500,000|Nothing in the showroom at that deposit/);
    assertNoFaults(faults);
  });

  test("the price split shows 50% for a 2008–2009 car", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/drive-plan");
    const tier = page.getByRole("radio", { name: /2008–2009/ });
    test.skip((await tier.count()) === 0, "No car in stock can go on the Drive Plan, so the price split is not shown");
    await expect(page.getByText("Any price, split"), "the price split is missing").toBeVisible();
    await tier.click();
    await expect(tier, "the 2008–2009 tier was not selected").toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("You pay (50%)", { exact: true }), "the split does not show a 50% deposit for a 2008–2009 car").toBeVisible();
    await expect(page.getByText("Autochek finances (50%), once it approves", { exact: true }), "the split does not show Autochek financing 50%").toBeVisible();
    assertNoFaults(faults);
  });
});
