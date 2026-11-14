import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** The pages a visitor reads rather than fills in: each answers 200, has a headline, and raises no fault. */
const PAGES: { path: string; headline: RegExp }[] = [
  { path: "/about", headline: /tells the truth about what it sells/ },
  { path: "/privacy", headline: /Your details, and what we do with them/ },
  { path: "/sell", headline: /Selling a car\? Start with Sabicars/ },
  { path: "/find", headline: /Tell us the car you want/ },
  { path: "/check", headline: /Check any car/ },
  { path: "/hummer-bus", headline: /The Toyota Hiace Hummer bus/ },
  { path: "/fleet", headline: /./ },
];

test.describe("Pages", () => {
  // Dead links keep the visitor in the showroom (audit, 9 November 2026: a bare "404" with no way back).
  // Not watched for faults: the browser logs the 404 itself as a console error.
  test("an old car link says the car is no longer listed, with a way to the cars", async ({ page }) => {
    const response = await page.goto("/vehicles/no-such-car-e2e");
    expect(response?.status(), "a missing car did not answer 404").toBe(404);
    await expect(page.getByRole("heading", { level: 1 }), "the missing car page shows no headline").toHaveText("This car is no longer listed.");
    await expect(page.getByRole("main").getByRole("link", { name: "See cars for sale" }), "the missing car page offers no way to the cars").toHaveAttribute("href", "/vehicles");
  });

  test("a wrong address keeps the site's frame and says what happened", async ({ page }) => {
    const response = await page.goto("/no-such-page-e2e");
    expect(response?.status(), "a wrong address did not answer 404").toBe(404);
    await expect(page, "a wrong address is titled like the home page").toHaveTitle(/^Page not found/);
    await expect(page.getByRole("heading", { level: 1 }), "the wrong-address page shows no headline").toHaveText("That page is not here.");
    await expect(page.getByRole("banner"), "the wrong-address page lost the header").toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to content" }), "the wrong-address page lost the skip link").toBeAttached();
    await expect(page.getByRole("main").getByRole("link", { name: "Request a car" }), "the wrong-address page offers no request").toHaveAttribute("href", "/find");
  });

  for (const { path, headline } of PAGES) {
    test(`${path} opens with its headline`, async ({ page }) => {
      const faults = watchForFaults(page);
      const response = await page.goto(path);
      expect(response?.status(), `${path} did not answer 200`).toBe(200);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1, `${path} shows no headline`).toBeVisible();
      await expect(h1, `${path} does not open with the headline it should`).toContainText(headline);
      assertNoFaults(faults);
    });
  }
});
