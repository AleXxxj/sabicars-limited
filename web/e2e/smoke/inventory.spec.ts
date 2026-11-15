import { expect, test, type Locator, type Page } from "@playwright/test";
import { assertNoFaults, stockCount, watchForFaults } from "../helpers";

/**
 * Each listed car's name and price, read from its card's link ("2017 Hyundai Elantra, ₦9,500,000"); the price is null
 * for "Price on request".
 */
async function listed(scope: Locator): Promise<{ name: string; price: number | null }[]> {
  const labels = await scope.getByRole("article").evaluateAll((cards) => cards.map((c) => c.querySelector("a[aria-label]")?.getAttribute("aria-label") ?? ""));
  return labels.map((label) => {
    const price = label.match(/, ₦([\d,]+)$/)?.[1];
    return { name: label.replace(/, (₦[\d,]+|Price on request)$/, ""), price: price ? Number(price.replace(/,/g, "")) : null };
  });
}

/** Every car listed is at or under `max` naira, or none is and the page says so, with a way on. */
async function allAtOrUnder(page: Page, max: number, what: string) {
  const cars = await listed(page.locator("#results"));
  if (!cars.length) {
    await expect(page.getByRole("heading", { level: 2, name: /^Nothing matches/ }), `${what}: no car listed, and the page does not say so`).toBeVisible();
    await expect(page.getByRole("link", { name: /Request a car/ }).first(), `${what}: no car listed, and no way to request one`).toBeVisible();
    return;
  }
  for (const c of cars) {
    expect(c.price, `${what}: ${c.name} is listed with no price`).not.toBeNull();
    expect(c.price!, `${what}: ${c.name} is listed at ₦${c.price!.toLocaleString("en-NG")}`).toBeLessThanOrEqual(max);
  }
}

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
    // The plain list names no total (the owner, 14 November 2026): no count sentence, and "All" carries no number.
    await expect(page.getByText(/\d+ vehicles? in stock/), "the plain list states the total stock").toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Vehicle type" }).getByRole("link", { name: /^All$/ }), 'the "All" chip carries a number').toBeVisible();
    assertNoFaults(faults);
  });

  test("choosing a body type narrows the list and says how many are left", async ({ page }) => {
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock === 0, "The site has no vehicles in stock");
    const types = page.getByRole("navigation", { name: "Vehicle type" });
    // A shape chip: "SUVs 34", "Buses 7"… — not "Saved", not "All" and not the "Luxury" segment.
    const chips = types.getByRole("link").filter({ hasNotText: /^(Saved|All|Luxury)\b/ });
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

  test("the fourth box searches: a make typed and sent keeps only that make's cars, says what it searched for, and is no page for Google", async ({ page }) => {
    // The owner, 15 November 2026: "Newest listings" became Search, as on the screenshot sent.
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock === 0, "The site has no vehicles in stock");
    // The make with the most cars, and how many, as the make box lists it: "Toyota (30)".
    const [, make, count] = (await page.locator('select[name="make"] option').nth(1).innerText()).match(/^(.+) \((\d+)\)$/) ?? [];
    expect(make, "the make box lists no make with its count").toBeTruthy();
    const search = page.getByRole("searchbox", { name: "Search by make, model, year or budget" });
    await expect(search, "the fourth box is not a search box").toBeVisible();
    await expect(search, 'the search box does not say "Search"').toHaveAttribute("placeholder", "Search");
    await search.fill(make);
    await search.press("Enter");
    await page.waitForURL(/[?&]q=/);
    const said = new RegExp(`^${count} vehicles? in stock match(es)? “${make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}”$`);
    await expect(page.getByText(/\d+ vehicles? in stock/).first(), `the search for ${make} does not say "${count} … match “${make}”"`).toHaveText(said);
    for (const c of await listed(page.locator("#results"))) expect(c.name.toLowerCase(), `a search for ${make} lists ${c.name}`).toContain(make.toLowerCase());
    await expect(search, "the search box does not keep what was searched").toHaveValue(make);
    await expect(page.locator('meta[name="robots"]'), "a search is open to search engines").toHaveAttribute("content", /noindex/);
    // Emptied, the box brings every car back at once.
    await search.fill("");
    await page.waitForURL(/\/vehicles$/);
    assertNoFaults(faults);
  });

  test("every dropdown shows its down-arrow, so a buyer knows to tap it", async ({ page }) => {
    // It never showed until 15 November 2026: the arrow was a class that drew nothing.
    await page.goto("/vehicles");
    for (const name of ["make", "price", "condition", "sort"]) {
      const box = page.locator(`select[name="${name}"]`);
      if (name === "sort" && !(await box.count())) continue;
      expect(await box.evaluate((el) => getComputedStyle(el).backgroundImage), `the ${name} box shows no down-arrow`).toContain("data:image/svg+xml");
    }
  });

  test("a budget typed in the search box keeps only cars at or under it", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/vehicles?q=under%2015m");
    expect(response?.status(), "a typed budget did not answer 200").toBe(200);
    await allAtOrUnder(page, 15_000_000, 'the search "under 15m"');
    assertNoFaults(faults);
  });

  test("Any price offers Under ₦10m, and it keeps only cars under ₦10m, or says none is in and offers to find one", async ({ page }) => {
    // The owner, 15 November 2026: offered even before a car that cheap is listed.
    const faults = watchForFaults(page);
    await page.goto("/vehicles");
    const price = page.locator('select[name="price"]');
    await expect(price.locator("option", { hasText: "Under ₦10m" }), 'Any price has no "Under ₦10m"').toHaveCount(1);
    await price.selectOption({ label: "Under ₦10m" });
    await page.waitForURL(/[?&]price=-10000000/);
    await allAtOrUnder(page, 10_000_000, '"Under ₦10m"');
    assertNoFaults(faults);
  });

  test("the sort sits on a line above the list: lowest price first puts the cheapest first, and the filters stay", async ({ page }) => {
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock < 2, "Fewer than two cars to sort");
    await expect(page.locator("form").filter({ has: page.locator('select[name="make"]') }).locator('select[name="sort"]'), "the sort is still one of the four boxes").toHaveCount(0);
    const sort = page.locator('select[name="sort"]');
    await expect(sort, "there is no sort above the list").toBeVisible();
    await sort.selectOption("price_asc");
    await page.waitForURL(/[?&]sort=price_asc/);
    const prices = (await listed(page.locator("#results"))).map((c) => c.price).filter((p): p is number => p !== null);
    expect(prices, "lowest price first does not list the cheapest first").toEqual([...prices].sort((a, b) => a - b));
    // A filter chosen after the sort keeps it.
    await page.locator('select[name="condition"]').selectOption({ index: 1 });
    await page.waitForURL(/condition=/);
    expect(page.url(), "choosing a filter lost the sort").toContain("sort=price_asc");
    assertNoFaults(faults);
  });

  test("the Saved chip comes first and shows only the cars this visitor saved, which stay on the phone", async ({ page }) => {
    // The owner, 15 November 2026, from the screenshot sent: a "Saved" chip first in the row.
    const faults = watchForFaults(page);
    const inStock = await stockCount(page);
    test.skip(inStock === 0, "The site has no vehicles in stock");
    const types = page.getByRole("navigation", { name: "Vehicle type" });
    await expect(types.getByRole("link").first(), "Saved is not the first chip").toHaveText(/^\s*Saved\s*$/);
    const save = page.locator("#results").getByRole("article").first().getByRole("button", { name: /^Save the / });
    const title = (await save.getAttribute("aria-label"))!.replace(/^Save the /, "");
    await save.click();
    await expect(page.getByRole("button", { name: `Remove the ${title} from saved cars` }).first(), "the heart did not save the car").toBeVisible();
    await types.getByRole("link", { name: "Saved" }).click();
    await page.waitForURL(/[?&]saved=1/);
    await expect(page.getByRole("heading", { level: 1 }), "the Saved view does not say what it shows").toHaveText("Cars you have saved");
    await expect(types.getByRole("link", { name: "Saved" }), "the Saved chip is not marked as chosen").toHaveAttribute("aria-current", "true");
    await expect(types.getByRole("link", { name: /^All$/ }), '"All" is still marked as chosen').not.toHaveAttribute("aria-current", "true");
    const saved = page.locator("#saved").getByRole("article");
    await expect(saved, "the Saved view does not show just the one car saved").toHaveCount(1, { timeout: 15_000 });
    await expect(saved.getByRole("button", { name: `Remove the ${title} from saved cars` }), `the Saved view does not show the ${title}`).toBeVisible();
    await expect(page.locator('meta[name="robots"]'), "one visitor's saved cars are open to search engines").toHaveAttribute("content", /noindex/);
    await types.getByRole("link", { name: /^All$/ }).click();
    await page.waitForURL(/\/vehicles$/);
    await expect(page.locator("#results").getByRole("article").first(), '"All" does not bring every car back').toBeVisible();
    assertNoFaults(faults);
  });
});
