import { expect, test, type Page } from "@playwright/test";
import { assertNoFaults, openFirstVehicle, stockCount, watchForFaults } from "../helpers";

/**
 * Phone only. Most Sabicars buyers arrive on a phone, and a page wider than
 * the screen is the fault they feel most: it drifts sideways under a thumb
 * and the price slides off the edge.
 */
async function overflowPx(page: Page): Promise<number> {
  // Settle layout first: fonts, images and the slideshow all arrive after load.
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("On a phone", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, "Only the phone project checks for sideways overflow");
  });

  test("the homepage does not scroll sideways", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    expect(await overflowPx(page), "the homepage is wider than the phone's screen").toBeLessThanOrEqual(1);
    assertNoFaults(faults);
  });

  test("a car's page does not scroll sideways", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    expect(await overflowPx(page), "the car page is wider than the phone's screen").toBeLessThanOrEqual(1);
    await expect(page.getByRole("link", { name: "Enquire", exact: true }), "the phone's bottom dock has no Enquire button").toBeVisible();
    assertNoFaults(faults);
  });
});
