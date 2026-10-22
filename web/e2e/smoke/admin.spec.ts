import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/** The staff entrance: the sign-in form is there, and the admin is closed to anyone not signed in. */
test.describe("Admin", () => {
  test("the sign-in page shows the form", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/admin/login");
    expect(response?.status(), "the sign-in page did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { name: "Staff sign in" }), "the sign-in page shows no heading").toBeVisible();
    await expect(page.locator('input[name="email"]'), "the sign-in form has no email field").toBeVisible();
    await expect(page.locator('input[name="password"]'), "the sign-in form has no password field").toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i }), "the sign-in form has no Sign in button").toBeVisible();
    assertNoFaults(faults);
  });

  test("the admin sends a signed-out visitor to sign in", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/admin/partners");
    await page.waitForURL(/\/admin\/login/);
    expect(new URL(page.url()).pathname, "a signed-out visitor was not sent to the sign-in page").toBe("/admin/login");
    await expect(page.getByRole("heading", { name: "Staff sign in" }), "the sign-in page did not render after the redirect").toBeVisible();
    await expect(page.getByText("Partners"), "the partners page showed to a signed-out visitor").toHaveCount(0);
    assertNoFaults(faults);
  });
});
