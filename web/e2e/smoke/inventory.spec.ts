import { expect, test } from "@playwright/test";
import { assertNoFaults, stockCount, watchForFaults } from "../helpers";

/**
 * The inventory: the list a buyer filters down to the car they want. Every
 * card carries a price (or says "Price on request"), the body-type chips
 * narrow the list and say by how much, and a deposit ceiling from the Drive
 * Plan finder is explained in words.
 */
test.describe("Inventory", () => {
  test("the inventory lists cars with prices", async ({ page }) => {
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock === 0, "The site has no vehicles in stock");
    await expect(page.getByRole("heading", { level: 1 }), "the inventory page shows no heading").toBeVisible();
    const cards = page.getByRole("article").filter({ hasText: /₦[\d,]+|Price on request/ });
    await expect(cards.first(), "the inventory shows no vehicle card with a price").toBeVisible();
    expect(await cards.count(), "fewer priced cards than the stock count promises").toBeGreaterThanOrEqual(Math.min(inStock, 1));
    assertNoFaults(faults);
  });

  test("choosing a body type narrows the list and says how many are left", async ({ page }) => {
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock === 0, "The site has no vehicles in stock");
    const types = page.getByRole("navigation", { name: "Vehicle type" });
    // A shape chip: "SUVs 34", "Buses 7"… — not "All" and not the "Luxury" segment.
    const chips = types.getByRole("link").filter({ hasNotText: /^(All|Luxury)\b/ });
    test.skip((await chips.count()) === 0, "The inventory has no body-type chips to choose from");
    const chip = (await chips.filter({ hasText: /^SUVs\b/ }).count()) ? chips.filter({ hasText: /^SUVs\b/ }).first() : chips.first();
    const chipText = (await chip.innerText()).trim();
    const label = chipText.replace(/\s*\d+\s*$/, "");
    const expected = Number(chipText.match(/(\d+)\s*$/)?.[1]);
    expect(expected, `the "${label}" chip shows no count`).toBeGreaterThan(0);

    await chip.click();
    await page.waitForURL(/\/vehicles\?.*body=/);
    await expect(page.getByRole("heading", { level: 1 }), `the heading does not say the list is now ${label}`).toContainText(new RegExp(label.replace(/s$/, ""), "i"));
    await expect(page.getByText(/\d+ vehicles? in stock/).first(), `the count sentence does not match the ${expected} the chip promised`).toHaveText(
      new RegExp(`^${expected} vehicles? in stock$`),
    );
    await expect(types.getByRole("link", { name: new RegExp(`^${label}\\b`) }), `the "${label}" chip is not marked as chosen`).toHaveAttribute("aria-current", "true");
    assertNoFaults(faults);
  });

  test("a deposit ceiling explains itself in words", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/vehicles?maxDeposit=10000000");
    expect(response?.status(), "the inventory did not answer 200 with a deposit ceiling").toBe(200);
    const sentence = page.getByText(/On the Drive Plan with up to/);
    await expect(sentence, 'the inventory does not explain the deposit ceiling ("On the Drive Plan with up to…")').toBeVisible();
    await expect(sentence, "the sentence does not state the ₦10,000,000 ceiling").toContainText("₦10,000,000");
    await expect(sentence.getByRole("link", { name: "How the plan works" }), "the deposit sentence does not link to the Drive Plan page").toHaveAttribute("href", "/drive-plan");
    assertNoFaults(faults);
  });
});
