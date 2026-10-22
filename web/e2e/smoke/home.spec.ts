import { expect, test, type Page } from "@playwright/test";
import { PRIMARY_NAV } from "@/lib/navigation";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The homepage, as a buyer arriving from a video sees it: the headline, the
 * ways in, the Drive Plan question, and a car with a price on it.
 */

/** The live "Vehicles in stock today" figure the page states. */
async function vehiclesInStockToday(page: Page): Promise<number> {
  const tile = page.locator("dd").filter({ hasText: "Vehicles in stock today" }).first();
  await expect(tile, "the homepage no longer states how many vehicles are in stock").toBeVisible();
  const figure = (await tile.innerText()).match(/^\s*(\d+)/)?.[1];
  return Number(figure ?? 0);
}

test.describe("Home", () => {
  test("the homepage opens with its headline", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/");
    expect(response?.status(), "the homepage did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the homepage shows no headline").toContainText(/every deal.*on record/i);
    assertNoFaults(faults);
  });

  test("every primary section is one tap away", async ({ page, isMobile }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    if (isMobile) {
      // On a phone the sections live behind the Menu button and in the bottom bar.
      await page.getByRole("button", { name: "Menu" }).click();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await expect(menu, "the phone menu did not open").toBeVisible();
      for (const item of PRIMARY_NAV) {
        await expect(menu.getByRole("link", { name: item.label }), `the phone menu has no "${item.label}" link`).toBeVisible();
      }
      await page.getByRole("button", { name: "Close menu" }).click();
      await expect(page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: "Cars" }), "the phone's bottom bar has no Cars tab").toBeVisible();
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      for (const item of PRIMARY_NAV) {
        await expect(nav.getByRole("link", { name: item.label, exact: true }), `the header has no "${item.label}" link`).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "Browse cars" }).first(), "the header has no Browse cars button").toBeVisible();
    }
    assertNoFaults(faults);
  });

  test('the hero asks "What can I afford?"', async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const link = page.getByRole("link", { name: /what can i afford/i });
    await expect(link, 'the hero has no "What can I afford?" link').toBeVisible();
    await expect(link, "the affordability link does not lead to the Drive Plan finder").toHaveAttribute("href", /#drive-plan$/);
    assertNoFaults(faults);
  });

  test("the homepage shows a car with its price", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const inStock = await vehiclesInStockToday(page);
    test.skip(inStock === 0, "The site has no vehicles in stock, so there is no card to check");
    const card = page.getByRole("article").filter({ hasText: /₦[\d,]+|Price on request/ }).first();
    await expect(card, "the homepage shows no vehicle card with a price").toBeAttached();
    await expect(card.getByRole("heading", { level: 3 }), "the vehicle card names no model").not.toBeEmpty();
    await expect(card.getByRole("link").first(), "the vehicle card does not link to the car's page").toHaveAttribute("href", /^\/vehicles\/[a-z0-9-]+$/);
    assertNoFaults(faults);
  });
});
