import { expect, test } from "@playwright/test";

/**
 * No dead doors. A tester on another marketplace clicked a feature that
 * showed nothing, and it was what she remembered. Every link a visitor can
 * see on the pages they land on must lead to a page that answers, and no
 * link may go nowhere ("#", or empty).
 */
const LANDING = ["/", "/vehicles", "/contact", "/partners", "/ask", "/drive-plan"];

test.describe("Every link leads somewhere", () => {
  for (const path of LANDING) {
    test(`${path}: every link on the page answers`, async ({ page, request }) => {
      await page.goto(path);
      // The notification bell fills its feed after the page has drawn; its links count too.
      await page.waitForLoadState("networkidle");
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
      const dead = hrefs.filter((h) => h.trim() === "" || h.trim() === "#");
      expect(dead, `${path} has links that go nowhere`).toEqual([]);

      // Internal pages only: other sites, phone, mail and WhatsApp links are not ours to answer for.
      const internal = [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).map((h) => h.split("#")[0]))].filter(Boolean);
      const failures: string[] = [];
      for (const href of internal) {
        const res = await request.get(href, { maxRedirects: 5 });
        if (res.status() >= 400) failures.push(`${res.status()} ${href}`);
      }
      expect(failures, `${path} links to pages that do not answer`).toEqual([]);
    });
  }
});
