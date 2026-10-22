import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** Insights: the article index and one article, read to its comments. */
test.describe("Insights", () => {
  test("the Insights page opens", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/blog");
    expect(response?.status(), "the Insights page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the Insights page shows no headline").toContainText("Know more than the seller.");
    assertNoFaults(faults);
  });

  test("an article opens from its card", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/blog");
    test.skip((await page.getByText("Nothing here yet.").count()) > 0, "No article is published yet");
    const card = page.locator('a[href^="/blog/"]').first();
    await expect(card, "the Insights page lists no article").toBeVisible();
    const headline = (await card.getByRole("heading").first().innerText()).trim();
    await card.click();
    await page.waitForURL(/\/blog\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 }), `the article is not headed "${headline}"`).toHaveText(headline);
    // Anchored: the related-article cards further down say "19 October 2026 · 6 min read".
    await expect(page.getByText(/^\d+ min read$/), "the article does not say how long it takes to read").toBeVisible();
    await expect(page.getByRole("heading", { name: /comments?$|Questions and comments/ }), "the article has no comments section").toBeVisible();
    assertNoFaults(faults);
  });
});
