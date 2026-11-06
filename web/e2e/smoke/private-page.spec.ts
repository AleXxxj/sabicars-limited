import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * A partner's private page opens only with the token in their link. A
 * malformed token and a well-formed one nobody holds are both turned away
 * politely, and neither is a server error.
 */
test.describe("A partner's private page", () => {
  for (const [what, token] of [
    ["a malformed token", "not-a-token"],
    ["a token nobody holds", randomUUID()],
  ] as const) {
    test(`turns away ${what}`, async ({ page }) => {
      const faults = watchForFaults(page);
      const response = await page.goto(`/partner/${token}`);
      expect(response?.status(), `the private page answered ${response?.status()} to ${what} instead of a page`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), `the private page does not say the link is not valid for ${what}`).toHaveText("This link is not valid.");
      // The way back is Log in (the page's own button, not the header's): the partner types their number and the link is emailed.
      await expect(page.getByRole("main").getByRole("link", { name: "Log in", exact: true }), "the invalid-link page offers no way to log in").toHaveAttribute("href", "/partner");
      await expect(page.getByText("Your bank account"), `${what} showed a partner's bank account section`).toHaveCount(0);
      assertNoFaults(faults);
    });
  }
});

/** The cars a partner shares, and the links they share them with. Read-only: nobody logs in, no code is real. */
test.describe("Cars to share", () => {
  test("ask a visitor to log in, and are never indexed", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/partner/cars");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the cars to share opened without a log-in").toHaveText("Log in to see the cars to share.");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    assertNoFaults(faults);
  });

  test("a car link with an unknown code still lands on the car, and records nobody", async ({ request }) => {
    const res = await request.get("/r/ZZ0000/2013-toyota-hiace-hummer-1", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers().location ?? "", "https://x").pathname, "the car link did not lead to the car").toBe("/vehicles/2013-toyota-hiace-hummer-1");
    expect(res.headers()["set-cookie"] ?? "", "an unknown code must not be recorded").not.toContain("sc_partner");
    expect(res.headers()["cache-control"], "a referral answer must never be cached").toContain("no-store");
    // Anything that is not a car's address goes to the home page.
    const odd = await request.get("/r/ZZ0000/..%2F..%2Fadmin", { maxRedirects: 0 });
    expect(new URL(odd.headers().location ?? "", "https://x").pathname).toBe("/");
  });
});
