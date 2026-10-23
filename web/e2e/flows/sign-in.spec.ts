import { expect, test } from "@playwright/test";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The staff sign-in form, end to end, with a password that is wrong on
 * purpose. The money-path test signs in without the form (see
 * signInAsStaff), so that the real password is never typed into a page whose
 * trace a public repository would publish; this keeps the form itself
 * covered. Needs Supabase configured (the form answers "not set up yet"
 * otherwise), and no secret: the account does not exist.
 */
test("the staff sign-in form refuses a wrong password without saying which part was wrong", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Supabase is not configured for this run",
  );
  const faults = watchForFaults(page);
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Staff sign in" }), "the sign-in page did not open").toBeVisible();
  await page.locator('input[name="email"]').fill("e2e-nobody@example.invalid");
  await page.locator('input[name="password"]').fill("not-the-password-0000");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Next.js keeps an empty role="alert" route announcer on every page; the form's message is the one with text.
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
    "a wrong password was not refused with a message",
  ).toBeVisible();
  expect(new URL(page.url()).pathname, "a wrong password left the sign-in page").toBe("/admin/login");
  assertNoFaults(faults);
});
