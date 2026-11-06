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
