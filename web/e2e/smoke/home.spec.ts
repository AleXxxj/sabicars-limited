import { expect, test, type Page } from "@playwright/test";
import { CARS_NAV, MAIN_NAV, MORE_ITEMS, TAB_BAR } from "@/lib/navigation";
import { PARTNER_RULES } from "@/lib/referral";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The homepage, as a buyer arriving from a video sees it: the headline, the
 * ways in, the Drive Plan question, and a car with a price on it.
 */

/** The live stock count the page states, on its "See all N cars for sale" link (0 when nothing is in stock and the section is hidden). */
async function vehiclesInStockToday(page: Page): Promise<number> {
  const link = page.getByRole("link", { name: /See all \d+ cars for sale/ }).first();
  if (!(await link.count())) return 0;
  return Number((await link.innerText()).match(/(\d+)/)?.[1] ?? 0);
}

test.describe("Home", () => {
  test("the homepage opens with its headline", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/");
    expect(response?.status(), "the homepage did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the homepage shows no headline").toContainText(/every deal.*on record/i);
    assertNoFaults(faults);
  });

  test("every section is in the header, the tab bar or More", async ({ page, isMobile }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    if (isMobile) {
      // On a phone the main sections live in the bottom bar.
      const tabs = page.getByRole("navigation", { name: "Quick" });
      await expect(tabs.getByRole("link", { name: "Cars", exact: true }), "the phone's bottom bar has no Cars tab").toBeVisible();
      for (const item of TAB_BAR) {
        await expect(tabs.getByRole("link", { name: item.label, exact: true }), `the phone's bottom bar has no "${item.label}" tab`).toBeVisible();
      }
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      for (const item of MAIN_NAV) {
        await expect(nav.getByRole("link", { name: item.label, exact: true }), `the header has no "${item.label}" link`).toBeVisible();
      }
      await expect(
        page.getByRole("banner").getByRole("link", { name: CARS_NAV.label, exact: true }),
        `the header has no ${CARS_NAV.label} button`,
      ).toBeVisible();
    }
    // On every width, everything else is behind More.
    await page.getByRole("button", { name: "More", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "More" });
    await expect(menu, "the More menu did not open").toBeVisible();
    for (const item of MORE_ITEMS) {
      await expect(menu.getByRole("link", { name: item.label }), `the More menu has no "${item.label}" link`).toBeVisible();
    }
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu, "the More menu did not close").toBeHidden();
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

  test("Find your car suggests what is in stock, and always offers to ask", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Find your car" });
    await expect(search, "the homepage has no search field").toBeVisible();
    const options = page.getByRole("listbox", { name: "Suggestions" }).getByRole("option");
    // A budget is read wherever it sits in the sentence, past a year typed before it.
    await search.fill("2018 highlander 30m");
    await expect(options.filter({ hasText: "Cars up to ₦30M" }), "a budget typed after a year is not understood").toHaveCount(1);
    await search.fill("toyota");
    await expect(options.last(), "the last suggestion does not offer Ask Sabicars").toContainText("Ask Sabicars");
    if ((await vehiclesInStockToday(page)) > 0 && (await options.count()) > 1) {
      // A make in stock comes first, and it leads to that make's page.
      await options.first().click();
      await page.waitForURL(/\/buy\/[a-z0-9-]+$|\/hummer-bus$/);
    }
    assertNoFaults(faults);
  });

  test("the Hummer section shows the bus in pictures, with prices and never a head count", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "The home of the Hummer bus." });
    test.skip((await heading.count()) === 0, "No Hummer bus is in stock, so the section is hidden");
    const section = page.locator("section").filter({ has: heading }).last();
    // A small number in stock reads as little choice; the owner asked for the count to go.
    await expect(section, "the Hummer section states how many are in stock").not.toContainText(/\d+\s+in stock/i);
    await expect(section.getByRole("link", { name: /See every Hummer bus/ }), "the Hummer section does not lead to the Hummer page").toHaveAttribute("href", "/hummer-bus");
    // One large photograph and up to three more beneath it.
    const photos = await section.getByRole("img").count();
    expect(photos, "the Hummer section shows no photograph").toBeGreaterThanOrEqual(1);
    expect(photos, "the Hummer section shows more than a main photo and three beneath it").toBeLessThanOrEqual(4);
    assertNoFaults(faults);
  });

  test("Refer & Earn sets out the partner rules in full", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /Earn 1\.5% when they buy/ }) }).last();
    for (const [rule] of PARTNER_RULES) {
      await expect(section.getByText(rule, { exact: true }), `the partner rule "${rule}" is missing from the homepage`).toBeVisible();
    }
    assertNoFaults(faults);
  });

  test("the buying guides show as cards with their pictures", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Read before you buy." });
    test.skip((await heading.count()) === 0, "No guide is published, so the section is hidden");
    const cards = page.locator("section").filter({ has: heading }).last().locator('a[href^="/blog/"]');
    await expect(cards.first(), "the guides section shows no article card").toBeVisible();
    await expect(cards.filter({ has: page.locator("img") }).first(), "no guide card on the homepage shows its picture").toBeAttached();
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
