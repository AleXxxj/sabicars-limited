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
    // The bar may be slid away on arrival (its row of buttons on screen), so look for Enquire hidden or not.
    await expect(page.locator("[data-ask-dock]").getByRole("link", { name: "Enquire", exact: true, includeHidden: true }), "the phone's bottom dock has no Enquire button").toBeAttached();
    // The row of three under the photo must not widen the page either.
    await page.locator("#primary-actions").scrollIntoViewIfNeeded();
    expect(await overflowPx(page), "the car page is wider than the phone's screen once scrolled").toBeLessThanOrEqual(1);
    assertNoFaults(faults);
  });

  test("a car's phone bar and its row of buttons are never on screen together", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // Scroll positions around the row and around "Similar vehicles", from the top of the page to its end.
    const stops = await page.evaluate(() => {
      const y = window.scrollY;
      const row = document.querySelector("#primary-actions")!.getBoundingClientRect();
      const similar = document.querySelector("#similar")?.getBoundingClientRect();
      const list = [0, y + row.top - window.innerHeight + 20, y + row.top - 150, y + row.top, y + row.bottom - 10, y + row.bottom + 10, y + row.bottom + 400];
      if (similar) list.push(y + similar.top - window.innerHeight + 20, y + similar.top - 120, y + similar.top, y + similar.top + 300);
      list.push(document.documentElement.scrollHeight);
      return list.map((v) => Math.max(0, Math.round(v)));
    });
    // What the bar should be doing where the page stands now, and what it is doing.
    const state = () =>
      page.evaluate(() => {
        const b = document.querySelector<HTMLElement>("[data-ask-dock]")!;
        const top = window.innerHeight - parseFloat(getComputedStyle(b).bottom) - b.offsetHeight;
        const row = document.querySelector("#primary-actions")!.getBoundingClientRect();
        const similar = document.querySelector("#similar")?.getBoundingClientRect();
        const rowOnScreen = row.bottom > 0 && row.top < top;
        const pastSimilar = Boolean(similar && similar.top < top);
        const up = b.getAttribute("aria-hidden") === "false";
        return { y: window.scrollY, rowOnScreen, pastSimilar, up, ok: up === !(rowOnScreen || pastSimilar) };
      });
    for (const stop of stops) {
      await page.evaluate((v) => window.scrollTo(0, v), stop);
      await expect
        .poll(async () => JSON.stringify(await state()), { message: `at scroll ${stop} the bar is up while the row is on screen or Similar vehicles is in view, or down though nothing is in its way` })
        .toContain('"ok":true');
    }
    assertNoFaults(faults);
  });
});
