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

  test("a car's first screen ends at the phone bar, with the three buttons beneath it", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    await page.waitForLoadState("networkidle").catch(() => {});
    // On arrival: name, facts, price, the photo, then the bar, with the row under the photo out of sight beneath
    // the bar — never half under it, never above it. The first-screen box (--first-screen) makes that so.
    const arrival = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>("[data-ask-dock]")!;
      const barTop = window.innerHeight - parseFloat(getComputedStyle(b).bottom) - b.offsetHeight;
      const photo = document.querySelector<HTMLElement>('[aria-roledescription="carousel"]')!;
      const box = photo.parentElement!;
      const buttons = document.querySelector("#primary-actions [data-buttons]")!.getBoundingClientRect();
      // On a screen too short for the name, facts, price and photo, the photo runs under the bar as it always has.
      const fits = box.getBoundingClientRect().height <= parseFloat(getComputedStyle(box).minHeight) + 1;
      return { y: window.scrollY, barTop, fits, photoBottom: photo.getBoundingClientRect().bottom, buttonsTop: buttons.top, up: b.getAttribute("aria-hidden") === "false" };
    });
    expect(arrival.y, "the car page did not open at the top").toBe(0);
    expect(arrival.up, "the phone bar is not up on arrival").toBe(true);
    expect(arrival.buttonsTop, "the three buttons show above the phone bar on arrival").toBeGreaterThanOrEqual(arrival.barTop);
    expect(arrival.fits, "this phone cannot hold the first screen above the bar; the smoke phone should be a current one").toBe(true);
    expect(arrival.photoBottom, "the photo runs on under the phone bar on arrival").toBeLessThanOrEqual(arrival.barTop);
    expect(arrival.photoBottom, "the photo stops well short of the phone bar on arrival").toBeGreaterThanOrEqual(arrival.barTop - 24);
    assertNoFaults(faults);
  });

  test("a car's phone bar steps aside for the three buttons and is back once they have gone", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // Scroll positions well clear of the edges the bar settles on (24px either side): the top, the buttons clearly
    // out from under the bar, clearly in view, clearly gone with the call-back line still showing, further down,
    // and around "Similar vehicles", to the end of the page.
    const stops = await page.evaluate(() => {
      const y = window.scrollY;
      const b = document.querySelector<HTMLElement>("[data-ask-dock]")!;
      const barTop = window.innerHeight - parseFloat(getComputedStyle(b).bottom) - b.offsetHeight;
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      const buttons = document.querySelector("#primary-actions [data-buttons]")!.getBoundingClientRect();
      const line = document.querySelector("#primary-actions p")!.getBoundingClientRect();
      const similar = document.querySelector("#similar")?.getBoundingClientRect();
      const list = [0, y + buttons.top - barTop + 60, y + buttons.top - 200, y + buttons.bottom - header - 60, y + buttons.bottom - header + 40, y + line.bottom + 400];
      if (similar) list.push(y + similar.top - window.innerHeight + 40, y + similar.top - 200, y + similar.top + 300);
      list.push(document.documentElement.scrollHeight);
      return list.map((v) => Math.max(0, Math.round(v)));
    });
    // What the bar should be doing where the page stands now (nothing is asserted on the edges), and what it is doing.
    const state = () =>
      page.evaluate(() => {
        const b = document.querySelector<HTMLElement>("[data-ask-dock]")!;
        const barTop = window.innerHeight - parseFloat(getComputedStyle(b).bottom) - b.offsetHeight;
        const header = document.querySelector("header")!.getBoundingClientRect().bottom;
        const buttons = document.querySelector("#primary-actions [data-buttons]")!.getBoundingClientRect();
        const similar = document.querySelector("#similar")?.getBoundingClientRect();
        const clearlyIn = buttons.top < barTop - 30 && buttons.bottom > header + 30;
        const clearlyOut = buttons.top > barTop + 30 || buttons.bottom < header - 30;
        const clearlyPast = Boolean(similar && similar.top < barTop - 30);
        const clearlyBefore = !similar || similar.top > barTop + 30;
        const up = b.getAttribute("aria-hidden") === "false";
        const want = clearlyPast ? false : clearlyIn ? false : clearlyOut && clearlyBefore ? true : null;
        return { y: window.scrollY, clearlyIn, clearlyOut, clearlyPast, up, ok: want === null || up === want };
      });
    for (const stop of stops) {
      await page.evaluate((v) => window.scrollTo(0, v), stop);
      await expect
        .poll(async () => JSON.stringify(await state()), {
          message: `at scroll ${stop} the bar is up with the three buttons in view or at Similar vehicles, or down though nothing is in its way`,
        })
        .toContain('"ok":true');
    }
    assertNoFaults(faults);
  });
});
