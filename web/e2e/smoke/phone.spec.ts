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
    // The row of three under the photo must not widen the page either.
    await page.locator("#primary-actions").scrollIntoViewIfNeeded();
    expect(await overflowPx(page), "the car page is wider than the phone's screen once scrolled").toBeLessThanOrEqual(1);
    assertNoFaults(faults);
  });

  test("a car's first screen ends at the phone bar, with the row under the photo out of sight", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    await page.waitForLoadState("networkidle").catch(() => {});
    // On arrival: name, facts, price, the photo, then the bar — the row under the photo starts beneath the bar,
    // never half under it, which read as a broken page. The photo's box grows to make that so (--photo-min-h).
    expect(await page.evaluate(() => window.scrollY), "the car page did not open at the top").toBe(0);
    const row = await page.locator("#primary-actions").boundingBox();
    const bar = await page.locator("[data-ask-dock]").boundingBox();
    expect(row, "the car page has no row of buttons under the photo").not.toBeNull();
    expect(bar, "the car page has no phone bar").not.toBeNull();
    expect(row!.y, "the row under the photo peeks out above the phone bar on arrival").toBeGreaterThanOrEqual(bar!.y);
    // The photo's own count ("1 / 8") sits on the photo, so it stays clear of the bar even when the frame around
    // the photo runs under it (a two-line name or facts list pushes the frame's bottom edge that far).
    const count = await page.getByText(/^1 \/ \d+$/).first().boundingBox();
    expect(count, "the gallery does not count its photos").not.toBeNull();
    expect(count!.y + count!.height, "the photo count is cut off by the phone bar on arrival").toBeLessThanOrEqual(bar!.y);
    assertNoFaults(faults);
  });
});
