import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** The pages a visitor reads rather than fills in: each answers 200, has a headline, and raises no fault. */
const PAGES: { path: string; headline: RegExp }[] = [
  { path: "/about", headline: /tells the truth about what it sells/ },
  { path: "/privacy", headline: /Your details, and what we do with them/ },
  { path: "/sell", headline: /Selling a car\? Start with Sabicars/ },
  { path: "/find", headline: /Tell us the car you want/ },
  { path: "/hummer-bus", headline: /The Toyota Hiace Hummer bus/ },
  { path: "/fleet", headline: /./ },
];

test.describe("Pages", () => {
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
