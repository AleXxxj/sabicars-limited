import { expect, test } from "@playwright/test";

/**
 * The site's own endpoints, as the monitors and the outside services call
 * them: the health check answers, the guarded routes refuse a caller without
 * the secret, the webhook refuses an unsigned body, and the files crawlers
 * read are there. No browser is needed, so these run once, on the desktop
 * project.
 */
test.describe("API", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "API checks run once, on the desktop project");
  });

  test("the health check says the site and its database are up", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status(), "the health check did not answer 200").toBe(200);
    const body = (await response.json()) as { ok?: boolean; database?: string; version?: string; at?: string };
    expect(body.ok, "the health check does not say ok").toBe(true);
    expect(body.database, "the health check does not say the database is ok").toBe("ok");
    expect(typeof body.version, "the health check names no version").toBe("string");
    expect(response.headers()["cache-control"], "the health check may be cached").toContain("no-store");
  });

  test("the scheduled jobs refuse a caller without the secret", async ({ request }) => {
    const response = await request.get("/api/cron/payouts");
    expect(response.status(), "the payouts job ran for a caller without the secret").toBe(401);
  });

  test("the Paystack webhook refuses an unsigned body", async ({ request }) => {
    const response = await request.post("/api/payments/paystack/webhook", { data: { event: "transfer.success", data: { reference: "scp_00000000_00000000" } } });
    expect(response.status(), "the webhook accepted a body with no signature").toBe(400);
  });

  test("the browser error endpoint refuses garbage", async ({ request }) => {
    const response = await request.post("/api/ops/client-error", { headers: { "content-type": "text/plain" }, data: "this is not json" });
    expect(response.status(), "the error endpoint accepted garbage").toBe(400);
    const empty = await request.post("/api/ops/client-error", { data: { nothing: "useful" } });
    expect(empty.status(), "the error endpoint accepted a report with no message").toBe(400);
  });

  test("llms.txt describes Sabicars", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.status(), "llms.txt did not answer 200").toBe(200);
    expect(response.headers()["content-type"], "llms.txt is not served as text").toMatch(/text\//);
    const body = await response.text();
    expect(body, 'llms.txt does not mention "Sabicars"').toContain("Sabicars");
    expect(body, "llms.txt does not list the key pages").toContain("## Key pages");
  });

  test("the sitemap and robots.txt are served", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status(), "the sitemap did not answer 200").toBe(200);
    expect(await sitemap.text(), "the sitemap is not a sitemap").toContain("<urlset");
    const robots = await request.get("/robots.txt");
    expect(robots.status(), "robots.txt did not answer 200").toBe(200);
    expect(await robots.text(), "robots.txt does not point at the sitemap").toContain("sitemap.xml");
  });
});
