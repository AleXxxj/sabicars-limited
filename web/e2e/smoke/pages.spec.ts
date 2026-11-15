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
  // Dead links keep the visitor in the showroom (audit, 9 November 2026: a bare "404" with no way back), and the words
  // come in the page the server sends: Next's own not-found sent an empty page that the phone had to fill in with the
  // site's code, a blank white screen on slow data (15 November 2026). Not watched for faults.
  const GONE: { path: string; title: string; label: string }[] = [
    { path: "/vehicles/no-such-car-e2e", title: "This car is no longer listed.", label: "an old car link" },
    { path: "/reserve/no-such-car-e2e", title: "This car is no longer listed.", label: "a reserve link for a car that has gone" },
    { path: "/blog/no-such-article-e2e", title: "That page is not here.", label: "an old article link" },
    { path: "/ask/no-such-answer-e2e", title: "That page is not here.", label: "an old answer link" },
    { path: "/buy/no-such-model-e2e", title: "That page is not here.", label: "a model nobody stocks" },
    { path: "/compare/no-such-car-vs-no-other-car", title: "That page is not here.", label: "an old comparison" },
    { path: "/v/NOSUCHCODE", title: "That page is not here.", label: "an unknown report code" },
    { path: "/reserve/done?reference=nope", title: "That page is not here.", label: "a deposit return with no real reference" },
  ];
  for (const { path, title, label } of GONE) {
    test(`${label} says so at once, from the server, with a way to the cars, and is kept out of search`, async ({ page, browser }) => {
      const response = await page.goto(path);
      expect(response?.ok(), `${path} did not answer`).toBe(true);
      await expect(page.getByRole("heading", { level: 1 }), `${path} shows no headline`).toHaveText(title);
      await expect(page.getByRole("main").getByRole("link", { name: "See cars for sale" }), `${path} offers no way to the cars`).toHaveAttribute("href", "/vehicles");
      // As a 404 would be: search engines drop the address.
      await expect(page.locator('meta[name="robots"]').first(), `${path} could be listed by search engines`).toHaveAttribute("content", /noindex/);
      // In the page the server sends, not drawn later by the phone: with JavaScript off it reads the same.
      const plain = await browser.newContext({ javaScriptEnabled: false });
      try {
        const bare = await plain.newPage();
        await bare.goto(page.url());
        await expect(bare.getByRole("heading", { level: 1 }), `${path} is blank until the site's code arrives`).toHaveText(title);
        await expect(bare.getByRole("link", { name: "See cars for sale" }), `${path} offers no way on without the site's code`).toBeVisible();
      } finally {
        await plain.close();
      }
    });
  }

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
