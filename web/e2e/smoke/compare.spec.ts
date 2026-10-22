import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** Comparisons: the index, and one pair side by side with its estimated monthly row. */
test.describe("Compare", () => {
  test("the compare page opens", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/compare");
    expect(response?.status(), "the compare page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the compare page shows no headline").toContainText("Two cars. One honest answer.");
    assertNoFaults(faults);
  });

  test("a popular comparison shows the two cars with an estimated monthly row", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/compare");
    const pair = page.getByRole("link", { name: / vs / }).first();
    test.skip((await pair.count()) === 0, "The site lists no comparisons yet");
    const title = (await pair.innerText()).trim();
    await pair.click();
    await page.waitForURL(/\/compare\/.+/);
    await expect(page.getByRole("heading", { level: 1 }), `the comparison page is not headed "${title}"`).toHaveText(title);
    await expect(page.getByRole("rowheader", { name: "Price" }), "the comparison table has no Price row").toBeVisible();
    await expect(page.getByRole("rowheader", { name: /^Est\. monthly/ }), 'the comparison table has no "Est. monthly" row').toBeVisible();
    await expect(page.getByRole("heading", { name: "The differences that matter" }), "the comparison does not say what separates the cars").toBeVisible();
    assertNoFaults(faults);
  });
});
