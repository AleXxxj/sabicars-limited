import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** Ask Sabicars in public: the list of answers and one answer page. */
test.describe("Answers", () => {
  test("the answers page opens", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/ask");
    expect(response?.status(), "the answers page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the answers page shows no headline").toContainText("Straight answers to what buyers ask.");
    await expect(page.getByRole("button", { name: "Ask your own question" }), "the answers page offers no way to ask a question").toBeVisible();
    assertNoFaults(faults);
  });

  test("an answer opens from the list", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/ask");
    const first = page.locator('a[href^="/ask/"]').first();
    test.skip((await first.count()) === 0, "No answer is published yet");
    const question = (await first.innerText()).split("\n")[0].trim();
    await first.click();
    await page.waitForURL(/\/ask\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 }), `the answer page is not headed "${question}"`).toHaveText(question);
    await expect(page.getByRole("button", { name: "Ask a follow-up" }), "the answer page offers no follow-up question").toBeVisible();
    assertNoFaults(faults);
  });
});
