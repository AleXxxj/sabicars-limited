import { defineConfig, devices } from "@playwright/test";

/**
 * Two suites, one runner.
 *
 * `smoke` walks the deployed site the way a buyer and a member of staff
 * would, read-only, against SMOKE_BASE_URL (the Vercel deployment, or
 * http://localhost:3000). It runs on every deploy from GitHub Actions
 * (.github/workflows/smoke.yml) and never writes to the database.
 *
 * `flows` drives the money paths end to end — an enquiry, a partner
 * registering and adding a bank account, a car sold with a commission paid —
 * against a throwaway database (scripts/seed-e2e.mts) and a local production
 * build. It runs in GitHub Actions on every push and locally with
 * `npm run test:e2e`.
 */
const base = process.env.SMOKE_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]] : [["list"]],
  outputDir: "e2e-results",
  use: {
    baseURL: base,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // A phone is where most Sabicars buyers are; the smoke suite checks both.
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "user-agent": "sabicars-e2e (Playwright)" },
  },
  projects: [
    { name: "smoke", testMatch: /smoke\/.*\.spec\.ts/ },
    { name: "smoke-phone", testMatch: /smoke\/.*\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "flows", testMatch: /flows\/.*\.spec\.ts/ },
  ],
});
