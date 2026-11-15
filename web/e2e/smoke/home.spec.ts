import { expect, test, type Page } from "@playwright/test";
import { videoSource } from "@/lib/blog/video";
import { CARS_NAV, MAIN_NAV, TAB_BAR, moreItemsOn } from "@/lib/navigation";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The homepage, as a buyer arriving from a video sees it: the headline, the
 * ways in, the Drive Plan question, and a car with a price on it.
 */

/** The page's own data, as Next writes it into the HTML the server sent (its flight rows), in one piece. */
function flightOf(html: string): string {
  let flight = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) flight += JSON.parse(m[1]) as string;
  return flight;
}

/**
 * The homepage's hero video, read from the page's own data in the HTML the server sent, and read the way Admin,
 * Audience reads a link when it is saved (lib/blog/video.ts): a YouTube video, a video file, or a link the hero cannot
 * play. So what must happen is known from the page, and a test never skips on what the browser happened to do: a
 * missing "Watch video" or player fails (reviews of 7c1faac and 666b037, 15 November 2026).
 */
function heroVideoIn(html: string): { url: string; kind: "youtube" | "file" | "other" } | null {
  const m = flightOf(html).match(/"videoUrl":("(?:[^"\\]|\\.)*")/);
  if (!m) return null;
  const url = JSON.parse(m[1]) as string;
  const kind = videoSource(url)?.kind;
  return { url, kind: kind === "youtube" || kind === "file" ? kind : "other" };
}

/**
 * The files of the page Next shows when the app itself fails (app/global-error.tsx), named in every page's own data
 * (its root row's "G"): every page is sent them, and Next cannot start the page without them.
 */
function rootErrorCode(html: string): string[] {
  const flight = flightOf(html);
  const ref = flight.match(/"G":\["\$([0-9a-f]+)"/)?.[1];
  const row = ref ? flight.match(new RegExp(`(?:^|\\n)${ref}:I(\\[.*)`))?.[1] : undefined;
  if (!row) return [];
  try {
    const [, files] = JSON.parse(row) as [unknown, unknown];
    return Array.isArray(files) ? files.filter((f): f is string => typeof f === "string" && f.endsWith(".js")) : [];
  } catch {
    return [];
  }
}

/** The hero, awake: React has taken it over, so its buttons work and what it adds after the first paint is there. */
async function heroAwake(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Object.keys(document.querySelector("section.hh") ?? {}).some((k) => k.startsWith("__reactFiber"))), {
      message: "the hero never woke",
      timeout: 15_000,
    })
    .toBe(true);
}

/**
 * Stand-ins for YouTube's player, served in its place, that answer the page the way the real one does (its IFrame API
 * messages): one that plays and goes on playing; one that plays to its end after 3 s; one the phone refused to start,
 * which says so when asked (as on an iPhone in Low Power Mode); one refused without saying so (it tries to play, then
 * goes back to waiting); one still loading (it answers "buffering" and never plays); one that cannot play at all (a
 * deleted or private video: YouTube's error 150); and one that never answers at all.
 */
const answer = (body: string) => `<html><body style="margin:0;background:#111"><script>
function say(event, info) { parent.postMessage(JSON.stringify({ event: event, info: info, id: 1, channel: "widget" }), "*"); }
var heard = false;
addEventListener("message", function (e) {
  var d = String(e.data);
  if (d.indexOf("listening") >= 0 && !heard) { heard = true; first(); }
  if (d.indexOf("onAutoplayBlocked") >= 0 && typeof blocked === "function") blocked();
});
${body}
</script></body></html>`;
const PLAYER = {
  playing: answer(`function first() { say("initialDelivery", { playerState: 1 }); setInterval(function () { say("infoDelivery", { playerState: 1 }); }, 500); }`),
  ends: answer(`function first() { say("initialDelivery", { playerState: 1 }); setTimeout(function () { say("infoDelivery", { playerState: 0 }); }, 3000); }`),
  refused: answer(`function first() { say("initialDelivery", { playerState: -1 }); }
function blocked() { say("onAutoplayBlocked"); }`),
  refusedQuietly: answer(`function first() {
  say("initialDelivery", { playerState: -1 });
  setTimeout(function () { say("infoDelivery", { playerState: 3 }); }, 200);
  setTimeout(function () { say("infoDelivery", { playerState: -1 }); }, 500);
}`),
  loading: answer(`function first() { say("initialDelivery", { playerState: 3 }); }
setInterval(function () { say("infoDelivery", { playerState: 3 }); }, 500);`),
  unavailable: answer(`function first() { say("initialDelivery", { playerState: -1 }); say("onError", 150); }`),
  silent: "<html></html>",
};
const YOUTUBE = /youtube(-nocookie)?\.com|ytimg\.com/;

/**
 * How many cars the homepage's "Cars for sale" row shows (0 when nothing is in stock and the section is hidden). The
 * page names no total stock (the owner, 14 November 2026), so the row's cards are counted.
 */
async function vehiclesInStockToday(page: Page): Promise<number> {
  const link = page.getByRole("link", { name: "See all cars for sale" }).first();
  if (!(await link.count())) return 0;
  return page.locator("section").filter({ has: link }).last().getByRole("article").count();
}

test.describe("Home", () => {
  test("the homepage opens with its headline", async ({ page }) => {
    const faults = watchForFaults(page);
    const response = await page.goto("/");
    expect(response?.status(), "the homepage did not answer 200").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), "the homepage shows no headline").toContainText(/see it.*before you pay/i);
    assertNoFaults(faults);
  });

  test("every section is in the header, the tab bar or More", async ({ page, isMobile }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    if (isMobile) {
      // On a phone the main sections live in the bottom bar.
      const tabs = page.getByRole("navigation", { name: "Quick" });
      await expect(tabs.getByRole("link", { name: "Cars", exact: true }), "the phone's bottom bar has no Cars tab").toBeVisible();
      for (const item of TAB_BAR) {
        await expect(tabs.getByRole("link", { name: item.label, exact: true }), `the phone's bottom bar has no "${item.label}" tab`).toBeVisible();
      }
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      for (const item of MAIN_NAV) {
        await expect(nav.getByRole("link", { name: item.label, exact: true }), `the header has no "${item.label}" link`).toBeVisible();
      }
      await expect(
        page.getByRole("banner").getByRole("link", { name: CARS_NAV.label, exact: true }),
        `the header has no ${CARS_NAV.label} button`,
      ).toBeVisible();
    }
    // On every width, everything else is behind More.
    await page.getByRole("button", { name: "More", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "More" });
    await expect(menu, "the More menu did not open").toBeVisible();
    // More carries whatever that width's bar does not: Request a car on a phone, Check VIN on a wide screen.
    for (const item of moreItemsOn(isMobile ? "phone" : "wide")) {
      await expect(menu.getByRole("link", { name: item.label }), `the More menu has no "${item.label}" link`).toBeVisible();
    }
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu, "the More menu did not close").toBeHidden();
    assertNoFaults(faults);
  });

  test("the homepage never states how many cars are in stock", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    // The owner, 14 November 2026: "remove that 48, and any other place u name all vehicles amount". The Buy door, the
    // Buy tile and the cars row's link carried it; each type's own number (SUVs, Buses) stays.
    const buyDoor = page.getByRole("navigation", { name: "Start here" }).getByRole("link", { name: /^Buy/ });
    await expect(buyDoor, "the Buy door names a number of cars").not.toContainText(/\d+\s*cars/);
    await expect(page.getByRole("link", { name: /^Buy a car/ }), "the Buy tile names a number of cars").not.toContainText(/\d+\s*cars/);
    await expect(page.getByText(/See all \d+ cars/), "the cars row names the total stock").toHaveCount(0);
    assertNoFaults(faults);
  });

  test("Why people trust us: three promises, the founder's card and the rating, in one short block", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "Why people trust us" }) }).last();
    await expect(section.getByRole("listitem"), "the block does not make its three promises").toHaveCount(3);
    const story = section.getByRole("link", { name: /Founded by Ccristian Dee/ });
    await expect(story, "the founder's card does not lead to his story").toHaveAttribute("href", "/about");
    await expect(story, "the founder's card does not say Our story").toContainText("Our story");
    // The reviews in full are on About; here, at most the rating, leading there.
    const rating = section.getByRole("link", { name: /reviews?/ });
    if (await rating.count()) await expect(rating, "the rating does not lead to the reviews on About").toHaveAttribute("href", "/about#reviews");
    // Inside the page only: the floating prompt (outside <main>) may offer a review on its own.
    await expect(page.getByRole("main").getByRole("button", { name: "Write a review" }), "the homepage still has the full reviews block").toHaveCount(0);
    assertNoFaults(faults);
  });

  test("the Drive Plan question is short, and its answer keeps the two sentences that make it true", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section#drive-plan");
    test.skip((await section.count()) === 0, "No car is on the Drive Plan today, so the section is hidden");
    await expect(section.getByRole("heading", { name: "How much do you have?" })).toBeVisible();
    // The owner, 14 November 2026: the paragraph and the reach sentence went; the link says the rest.
    await expect(section, "the paragraph under the question is back").not.toContainText("Type what you have and see the cars");
    await expect(section, "the reach sentence is back").not.toContainText("of a price up to");
    await expect(section.getByRole("link", { name: "How the Drive Plan works" }), "the way to the full terms is missing").toHaveAttribute("href", "/drive-plan");
    if (await section.getByText(/cars? you can drive home with this/).count()) {
      await expect(section, '"drive home" is said without "if they approve you"').toContainText("Autochek lends you the rest if they approve you.");
      await expect(section, "the monthly figures are shown without saying they are a guide").toContainText("The monthly figures are a guide");
    }
    assertNoFaults(faults);
  });

  test("Visit or call: the park, the hours, the email, and a button to call or write", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const visit = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "Visit or call" }) }).last();
    await expect(visit.getByRole("link", { name: /Get directions/ }), "no way to the park").toHaveAttribute("href", /google\.com\/maps/);
    await expect(visit, "the hours are missing").toContainText(/Mon – Fri/);
    await expect(visit.getByRole("link", { name: /@/ }), "the email is not a link").toHaveAttribute("href", /^mailto:/);
    await expect(visit.getByRole("link", { name: /^Call / }), "there is no button to call").toHaveAttribute("href", /^tel:\+234/);
    await expect(visit.getByRole("link", { name: "Send a message" }), "there is no button to write").toHaveAttribute("href", "/contact");
    assertNoFaults(faults);
  });

  test("the footer is short and says who runs the site, where it is and how to call", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    // \s: the RC number is held to its "RC" by a no-break space.
    await expect(footer, "the footer does not name the company and its RC number").toContainText(/Sabicars Limited · CAC RC\s\d+/);
    await expect(footer.getByRole("link", { name: "Privacy notice" }), "the privacy notice is not in the footer").toHaveAttribute("href", "/privacy");
    // Once on any screen: in Quick links on a wide one, in the bottom line on a phone.
    const contact = footer.getByRole("link", { name: "Contact", exact: true }).filter({ visible: true });
    await expect(contact, "Contact is not in the footer, or shows twice").toHaveCount(1);
    await expect(contact, "Contact leads to the wrong page").toHaveAttribute("href", "/contact");
    await expect(footer.locator('a[href^="tel:"]').first(), "no number to call in the footer").toBeAttached();
    // Never "Pay 40%" without the year it holds for: the old footer said it bare.
    await expect(footer, 'the footer says "Pay 40%"').not.toContainText(/pay 40%/i);
    // The popular model links stay in the page on every screen (hidden on a phone, never left out), so search engines
    // reading the phone version still find them.
    const popular = footer.locator('nav[aria-label="Popular searches"] a');
    if (await popular.count()) {
      expect(await popular.count(), "more than twelve popular links").toBeLessThanOrEqual(12);
      await expect(popular.first(), "a popular link leads nowhere useful").toHaveAttribute("href", /^\/(buy\/[a-z0-9-]+|hummer-bus)$/);
    }
    assertNoFaults(faults);
  });

  test("the guide cards each carry a small picture of what the guide is about", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Read before you buy." });
    test.skip((await heading.count()) === 0, "No guide is published, so the section is hidden");
    const cards = page.locator("section").filter({ has: heading }).last().locator('a[href^="/blog/"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator(".gv"), `guide card ${i + 1} has no picture`).toHaveCount(1);
      await expect(cards.nth(i).locator(".gv"), `guide card ${i + 1}'s picture is read out`).toHaveAttribute("aria-hidden", "true");
    }
    assertNoFaults(faults);
  });

  test("the hero has its three doors: Buy, Sell and Check VIN", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const doors = page.getByRole("navigation", { name: "Start here" });
    for (const [name, href] of [
      [/^Buy/, "/vehicles"],
      [/^Sell/, "/sell"],
      [/^Check VIN/, "/check"],
    ] as const) {
      const door = doors.getByRole("link", { name });
      await expect(door, `the hero has no ${name} door`).toBeVisible();
      await expect(door, `the ${name} door leads to the wrong page`).toHaveAttribute("href", href);
    }
    assertNoFaults(faults);
  });

  test("the slideshow shows each service between the cars, and can be paused", async ({ page }) => {
    const faults = watchForFaults(page);
    // A hero video set in Admin, Audience plays first and holds the slides until it ends or is stopped (the test
    // below). Here the slides alone are tested: YouTube's player is answered with an empty page, so it never plays.
    await page.route(/youtube(-nocookie)?\.com\/embed\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>no video</title>" }));
    await page.goto("/");
    const controls = page.getByRole("group", { name: "Photos of our cars" });
    test.skip((await controls.count()) === 0, "No car has a photo, so there is no slideshow");
    const drivePlan = controls.getByRole("button", { name: /40% Drive Plan/ });
    await expect(drivePlan, "the slideshow has no Drive Plan slide").toHaveCount(1);
    await drivePlan.click();
    await expect(page.getByRole("heading", { level: 2, name: /Pay 40% now/ }), "the Drive Plan slide does not show its words").toBeVisible();
    // Someone who asked for less motion gets no auto-advance, so no pause button.
    const pause = controls.getByRole("button", { name: /Pause the slideshow|Play the slideshow/ });
    if (await pause.count()) await expect(pause).toBeVisible();
    assertNoFaults(faults);
  });

  test("the slides move on even when the page wakes after the first slide's time is up, as on a slow first load", async ({ page }) => {
    // Review of 666b037, 15 November 2026: on a line under about 0.6 Mbps the first slide's bar filled before the page
    // woke, its end went unheard, and the hero stayed on the first car for the whole visit. Here the page's code is
    // held for 8 s, longer than any slide's time.
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
      await new Promise((r) => setTimeout(r, 8_000));
      return route.continue();
    });
    await page.route(YOUTUBE, (r) => r.fulfill({ status: 200, contentType: "text/html", body: PLAYER.silent }));
    await page.goto("/");
    const segments = page.getByRole("group", { name: "Photos of our cars" }).locator(".hh-seg");
    test.skip((await segments.count()) < 2, "Fewer than two slides, so nothing moves on");
    await heroAwake(page);
    const current = () => page.locator('.hh-seg[aria-current="true"]').getAttribute("aria-label");
    const first = await current();
    await expect.poll(current, { message: "the slides never moved on after a slow first load", timeout: 15_000 }).not.toBe(first);
  });

  test("a keyboard user who asked for a video that never plays keeps their place when it is given up", async ({ page }) => {
    // Review of 666b037, 15 November 2026: the give-up took away the pill that had the focus; it fell to the page, and
    // the slideshow stayed paused for good.
    await page.clock.install();
    await page.route(YOUTUBE, (r) => r.fulfill({ status: 200, contentType: "text/html", body: PLAYER.silent }));
    const res = await page.goto("/");
    const hero = heroVideoIn((await res?.text()) ?? "");
    test.skip(!hero, "No hero video is set");
    test.skip(hero!.kind !== "youtube", "The hero video is not a YouTube link; the stand-in answers as YouTube's player does");
    const watch = page.getByRole("group", { name: "Photos of our cars" }).getByRole("button", { name: "Watch video" });
    await expect(watch, "a hero video is set, and Watch video is not offered").toBeVisible({ timeout: 15_000 });
    await heroAwake(page);
    await watch.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Loading video…" }), "Enter on Watch video did not ask for it").toBeVisible();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    await page.clock.runFor(50_000);
    await expect(page.getByRole("button", { name: /Watch video|Loading video/ }), "a video that never played was not given up").toHaveCount(0);
    const inHero = await page.evaluate(() => {
      const a = document.activeElement;
      return Boolean(a && a !== document.body && document.querySelector("section.hh")?.contains(a));
    });
    expect(inHero, "the keyboard's place fell to the page when the video was given up").toBe(true);
    // And once the keyboard leaves the hero, the slides move again.
    await page.locator("section.hh").evaluate((el) => {
      const after = [...document.querySelectorAll<HTMLElement>("a[href], button")].find((b) => !el.contains(b) && Boolean(el.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      after?.focus({ preventScroll: true });
    });
    await expect(page.locator("section.hh"), "the slideshow stayed paused after the keyboard left the hero").toHaveAttribute("data-running", "true");
  });

  test("a hero video never starts by itself: Watch video is offered on every load, and none of it loads unasked", async ({ page }) => {
    // The owner, 14 November 2026: the button on every load, and the video only once it is tapped.
    const video: string[] = [];
    page.on("request", (r) => {
      if (/youtube|ytimg|googlevideo/.test(r.url())) video.push(r.url());
    });
    const res = await page.goto("/");
    const hero = heroVideoIn((await res?.text()) ?? "");
    // Checked whether or not a video is set: awake, then long enough for a video that started by itself to be there.
    await heroAwake(page);
    await page.waitForTimeout(4_000);
    await expect(page.locator(".hh-video"), "the video was put on the page before anyone asked for it").toHaveCount(0);
    expect(video, "the video's player was fetched before anyone asked for it").toEqual([]);
    test.skip(!hero, "No hero video is set");
    const watch = page.getByRole("group", { name: "Photos of our cars" }).getByRole("button", { name: "Watch video" });
    if (hero!.kind === "other") {
      // A link the hero cannot play (an old one from before Admin checked links): nothing to offer.
      await expect(watch, `the hero offers a video it cannot play (${hero!.url})`).toHaveCount(0);
      return;
    }
    await expect(watch, "a hero video is set, and Watch video is not offered").toBeVisible();
    await page.reload();
    await expect(watch, "Watch video is not offered again after a reload").toBeVisible({ timeout: 15_000 });
  });

  /**
   * Opens the homepage with YouTube's player answered by a stand-in, taps "Watch video", and returns the strip. Skips
   * only on the page's own data: no video set, or a video file (the stand-ins answer as YouTube's player does).
   */
  async function watchWith(page: Page, player: keyof typeof PLAYER, path = "/") {
    let served = 0;
    await page.route(YOUTUBE, (r) => {
      served++;
      return r.fulfill({ status: 200, contentType: "text/html", body: PLAYER[player] });
    });
    const res = await page.goto(path);
    const hero = heroVideoIn((await res?.text()) ?? "");
    test.skip(!hero, "No hero video is set");
    test.skip(hero!.kind !== "youtube", "The hero video is not a YouTube link; these stand-ins answer as YouTube's player does");
    const controls = page.getByRole("group", { name: "Photos of our cars" });
    if (path === "/") {
      const watch = controls.getByRole("button", { name: "Watch video" });
      await expect(watch, "a hero video is set, and Watch video is not offered").toBeVisible({ timeout: 15_000 });
      await watch.click();
    }
    // A player that cannot play is gone again within moments: for it, that it was asked for.
    if (player === "unavailable") await expect.poll(() => served, { message: "asking for the video did not load YouTube's player" }).toBeGreaterThan(0);
    else await expect(page.locator('iframe[title="Sabicars showcase video"]'), "asking for the video did not load YouTube's player").toHaveCount(1);
    return controls;
  }

  test("Watch video plays the video; Stop brings the slides back, the button stays gone, and a fresh load offers it again", async ({ page }) => {
    // Sabicars' own errors only.
    const own: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !YOUTUBE.test(m.location().url)) own.push(m.text());
    });
    page.on("pageerror", (e) => own.push(e.message));
    const controls = await watchWith(page, "playing");
    // data-started is set only when the player says it plays; then it is shown.
    await expect(page.locator(".hh-video[data-started]"), "the player says it plays, and the hero did not take it as playing").toBeAttached({ timeout: 10_000 });
    await expect(page.locator(".hh-video.is-on"), "the video plays and is not shown").toHaveCount(1);
    const stop = controls.getByRole("button", { name: "Stop the video" });
    await expect(stop, "the video plays but there is no Stop button").toBeVisible();
    await expect(controls.getByRole("button", { name: "Sound on" }), "the video plays but there is no Sound button").toBeVisible();
    await expect(page.locator("section.hh"), "the slides kept moving under the video").toHaveAttribute("data-running", "false");
    await stop.click();
    await expect(page.locator(".hh-video"), "the video is still on the page after it was stopped").toHaveCount(0);
    // The slides carry on from wherever they were.
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides did not come back after the video was stopped").toHaveCount(1);
    await expect(controls.getByRole("button", { name: /Watch video|Loading video/ }), "the button came back after the video was watched").toHaveCount(0);
    expect(own, "the page had errors of its own while the video played").toEqual([]);
    // "Except another fresh reload": then the button is back (the owner, 14 November 2026).
    await page.reload();
    await expect(controls.getByRole("button", { name: "Watch video" }), "a fresh load does not offer the video again").toBeVisible({ timeout: 15_000 });
  });

  test("a hero video that plays to its end gives the slides back by itself, and the button stays gone", async ({ page }) => {
    const controls = await watchWith(page, "ends");
    await expect(page.locator(".hh-video[data-started]"), "the player says it plays, and the hero did not take it as playing").toBeAttached({ timeout: 10_000 });
    await expect(page.locator(".hh-video"), "the video stayed after it ended").toHaveCount(0, { timeout: 10_000 });
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides did not come back after the video ended").toHaveCount(1);
    await expect(controls.getByRole("button", { name: /Watch video|Loading video|Stop the video/ }), "the video's controls stayed after it ended").toHaveCount(0);
  });

  test("a hero video stops for good when the visitor scrolls past it, and the slides are there on the way back", async ({ page }) => {
    const controls = await watchWith(page, "playing");
    await expect(page.locator(".hh-video[data-started]"), "the player says it plays, and the hero did not take it as playing").toBeAttached({ timeout: 10_000 });
    // Down past the hero, a moment there, and back up, as a visitor would.
    await page.getByRole("heading", { name: "What do you need?" }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 1600);
    await expect(page.locator(".hh-video"), "the video kept playing after the hero was scrolled out of sight").toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides are not there on the way back").toHaveCount(1);
    await expect(controls.getByRole("button", { name: "Stop the video" }), "the video started again on the way back").toHaveCount(0);
    await expect(controls.getByRole("button", { name: /Watch video|Loading video/ }), "the button came back on the way back").toHaveCount(0);
  });

  for (const kind of ["refused", "refusedQuietly"] as const) {
    test(`a phone that will not start the video (${kind === "refused" ? "and says so" : "without saying so"}) gets the player with its play button within reach, and the words to tap it`, async ({ page }) => {
      const controls = await watchWith(page, kind);
      const player = page.locator('iframe[title="Sabicars showcase video"]');
      const tap = controls.getByText("Tap the video to play");
      await expect(tap, "a refused video does not say to tap it").toBeVisible({ timeout: 10_000 });
      // Words, not a pill like the button just tapped: tapping them would do nothing (review of 666b037).
      expect(await tap.evaluate((el) => getComputedStyle(el).borderTopWidth), "the words to tap the video look like a button").toBe("0px");
      const stop = controls.getByRole("button", { name: "Stop the video" });
      await expect(stop, "a refused video has no Stop button").toBeVisible();
      // A keyboard and a screen reader can reach the player's own play button too.
      await expect(player, "a keyboard cannot reach the refused player").toHaveAttribute("tabindex", "0");
      await expect(page.locator(".hh-photos"), "a screen reader cannot reach the refused player").not.toHaveAttribute("aria-hidden", "true");
      // Its play button is in the middle of the stage, where the headline lies on a wide screen: a tap there must reach it
      // (review, 14 November 2026: at 1180 px and up it landed on "you" in the headline).
      const hit = await page.evaluate(() => {
        const r = document.querySelector(".hh-video")!.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1))?.tagName;
      });
      expect(hit, "a tap on the refused player's play button lands on something else").toBe("IFRAME");
      await stop.click();
      await expect(player, "the video is still on the page after it was stopped").toHaveCount(0);
      await expect(page.locator(".hh-photos"), "the photos are read out after the video was stopped").toHaveAttribute("aria-hidden", "true");
      await expect(controls.getByRole("button", { name: /Watch video|Loading video/ }), "the button came back after the video was stopped").toHaveCount(0);
      await page.reload();
      await expect(controls.getByRole("button", { name: "Watch video" }), "a fresh load does not offer the video again").toBeVisible({ timeout: 15_000 });
    });
  }

  for (const kind of ["loading", "silent"] as const) {
    test(`a player that is ${kind === "loading" ? "still loading" : "not answering"} leaves the photos and "Loading video…" in place, takes no tap, and is given up after 45 s with no sign of life`, async ({ page }) => {
      // Review of 7c1faac, 15 November 2026: on a slow line the photos gave way to a black box after 2.5 s, and a tap
      // on it stopped the video for that visit. Until it plays, or the phone refuses it, nothing of the player shows; and
      // checked all the way to the give-up, not once at 5 s (review of 666b037), on the page's own clock.
      await page.clock.install();
      const controls = await watchWith(page, kind);
      const loading = controls.getByRole("button", { name: "Loading video…" });
      // From here the page's clock moves only when told to, so the seconds below are exact.
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
      for (let at = 4; at <= 40; at += 4) {
        await page.clock.runFor(4_000);
        await expect(loading, `the strip stopped saying the video is loading, ${at} s after the tap`).toBeVisible();
        await expect(page.locator(".hh-video.is-on"), `a player that is not playing covered the photos, ${at} s after the tap`).toHaveCount(0);
        await expect(controls.getByRole("button", { name: "Stop the video" }), `the strip gave way to the video's controls before it played, ${at} s after the tap`).toHaveCount(0);
      }
      const hit = await page.evaluate(() => {
        const r = document.querySelector(".hh-video")!.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, window.innerHeight - 1))?.tagName;
      });
      expect(hit, "a tap on the hero would reach a player that is not playing").not.toBe("IFRAME");
      await page.clock.runFor(8_000);
      await expect(loading, "a video that never played was not given up after 45 s").toHaveCount(0);
      await expect(page.locator(".hh-video"), "a video that never played is still on the page").toHaveCount(0);
      await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides are not there after the video was given up").toHaveCount(1);
    });
  }

  test("a hero video that cannot play gives the slides back at once, and staff previewing it are told why", async ({ page }) => {
    // Review of 666b037, 15 November 2026: YouTube said within a second that the video could not play, and the hero
    // said "Loading video…" for 45 s regardless; "See it play" in Admin never said why.
    const controls = await watchWith(page, "unavailable");
    await expect(controls.getByRole("button", { name: /Watch video|Loading video/ }), "a video that cannot play kept the strip waiting").toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator(".hh-video"), "a video that cannot play is still on the page").toHaveCount(0);
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides are not there").toHaveCount(1);
    await expect(page.getByText("This video can't play on the site"), "a visitor was shown the staff's note").toHaveCount(0);
    // Staff's preview, from Admin, Audience: "See it play".
    await watchWith(page, "unavailable", "/?video");
    await expect(page.getByRole("status").filter({ hasText: "This video can't play on the site" }), "the preview does not say why the video cannot play").toBeVisible({
      timeout: 5_000,
    });
  });

  test("the real YouTube player, where it plays in this browser, is shown as it plays: never unseen, and never broken", async ({ page }) => {
    // What YouTube's own player says to the page, heard alongside the hero.
    await page.addInitScript(() => {
      const w = window as unknown as { yt: unknown[] };
      w.yt = [];
      addEventListener("message", (e) => {
        if (!/youtube/.test(e.origin)) return;
        try {
          w.yt.push(JSON.parse(String(e.data)));
        } catch {
          /* not a message of its API */
        }
      });
    });
    const res = await page.goto("/");
    const hero = heroVideoIn((await res?.text()) ?? "");
    test.skip(!hero, "No hero video is set");
    test.skip(hero!.kind !== "youtube", "The hero video is not a YouTube link");
    const watch = page.getByRole("group", { name: "Photos of our cars" }).getByRole("button", { name: "Watch video" });
    await expect(watch, "a hero video is set, and Watch video is not offered").toBeVisible({ timeout: 15_000 });
    await watch.click();
    const shown = await page.locator(".hh-video[data-started]").waitFor({ state: "attached", timeout: 25_000 }).then(() => true, () => false);
    if (shown) return;
    const said = (await page.evaluate(() => (window as unknown as { yt: { event?: string; info?: unknown }[] }).yt)) ?? [];
    const error = said.find((m) => m.event === "onError");
    expect(error, `YouTube says the hero video cannot play (its error ${String(error?.info)}): it may have been deleted or made private. Put another link in Admin, Audience`).toBeUndefined();
    const playing = said.some((m) => (m.event === "infoDelivery" || m.event === "initialDelivery") && (m.info as { playerState?: number } | null)?.playerState === 1);
    expect(playing, "YouTube says the video plays, and the hero never showed it: it plays unseen, on the visitor's data").toBe(false);
    test.skip(true, "YouTube's player did not start in this browser");
  });

  test("scrolling fetches no other page ahead, with a mouse or a thumb; only pointing a mouse at a link does", async ({ page, isMobile }) => {
    const ahead: string[] = [];
    page.on("request", (r) => {
      const h = r.headers();
      if (h["next-router-prefetch"] || /[?&]_rsc=/.test(r.url())) ahead.push(new URL(r.url()).pathname);
    });
    if (!isMobile) {
      await page.goto("/");
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < height; y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(1500);
      // The owner, 14 November 2026: a phone fetched 25 pages (605 KB) on one scroll of the homepage, on paid data.
      expect(ahead, "pages were fetched ahead just by scrolling").toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      const door = page.getByRole("navigation", { name: "Start here" }).getByRole("link", { name: /^Sell/ });
      await door.hover();
      await expect.poll(() => ahead.includes("/sell"), { message: "pointing at a link did not fetch its page ahead", timeout: 5_000 }).toBe(true);
      return;
    }
    // A thumb: every swipe starts with a touch on whatever is under it, on the homepage's rows and the cars page's cards
    // nearly always a link (review, 14 November 2026: fetching on touch cost about 220 KB per scroll of /vehicles).
    // Raw touches, as Playwright's own tap sends them (Input.dispatchTouchEvent), each swipe starting on a link in
    // sight: Chrome's synthetic scroll gesture sent no touch to the page on GitHub's Linux runners (63f453b).
    const cdp = await page.context().newCDPSession(page);
    const swipeUpFrom = async ({ x, y }: { x: number; y: number }) => {
      const rise = Math.min(240, y - 20);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(y - (rise * i) / 8) }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    for (const path of ["/", "/vehicles"]) {
      await page.goto(path);
      await page.evaluate(() => {
        const w = window as unknown as { onLink: number };
        w.onLink = 0;
        document.addEventListener(
          "touchstart",
          (e) => {
            if ((e.target as Element | null)?.closest?.('a[href^="/"]')) w.onLink++;
          },
          { capture: true, passive: true },
        );
      });
      for (let i = 0; i < 8; i++) {
        // The first of the site's own links in sight, clear of the header and the tab bar, that a thumb there would touch.
        const spot = await page.evaluate(() => {
          for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
            const r = a.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            if (r.width < 24 || r.height < 24 || y < 140 || y > innerHeight - 140) continue;
            if (document.elementFromPoint(x, y)?.closest('a[href^="/"]') === a) return { x: Math.round(x), y: Math.round(y) };
          }
          return null;
        });
        if (!spot) break;
        await swipeUpFrom(spot);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(1500);
      expect(new URL(page.url()).pathname, `a swipe on ${path} was taken for a tap`).toBe(path);
      const onLink = await page.evaluate(() => (window as unknown as { onLink: number }).onLink);
      expect(onLink, `no swipe on ${path} began on a link, so this proves nothing`).toBeGreaterThan(0);
    }
    expect(ahead, "pages were fetched ahead by thumb swipes").toEqual([]);
    // A tap still opens the page it is on.
    await page.goto("/");
    await page.getByRole("navigation", { name: "Start here" }).getByRole("link", { name: /^Sell/ }).tap();
    await expect(page, "tapping a link did not open its page").toHaveURL(/\/sell$/);
  });

  test("a piece of the page's code that fails to arrive reloads the page once, onto a page that works, and raises no alert", async ({ page }) => {
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // The code already here stays; every new piece fails until the page loads again, as on a connection that stays
    // bad for a moment (one dropped piece alone is simply fetched again by Next, which needs no cure).
    const had = new Set(await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name)));
    // The reload is the next page the browser itself asks for (a page opened inside the site asks for none), counted
    // when it is asked for: by the time it has loaded, it has asked for its own pieces, and they must not fail too.
    let reloaded = false;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) reloaded = true;
    });
    const dropped: string[] = [];
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => {
      if (!reloaded && !had.has(route.request().url())) {
        dropped.push(route.request().url());
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    await page.getByRole("navigation", { name: "Start here" }).getByRole("link", { name: /^Check VIN/ }).click();
    // The page the visitor asked for, not the one they were on: the cure reloads straight onto it.
    await expect(page, "the visitor never reached the page they tapped").toHaveURL(/\/check$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 }), "the page they tapped did not open").toContainText("Check any car", { timeout: 20_000 });
    test.skip(dropped.length === 0, "This page needed no new code to open, so nothing could be dropped");
    await expect(page.getByText("Something went wrong on our side."), "the visitor saw the error page instead of a reload").toHaveCount(0);
    expect(reloaded, "the page did not load again after its code failed to arrive").toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem("sc_chunk_reload")), "the reload was not the site's own cure").not.toBeNull();
    // And the page it reloaded onto works, not just shows. Its words come from the server at once, but a tap does
    // something only once its code has arrived and woken it (React's mark on the button): on the live site that takes
    // a moment, and a tap before it is lost (GitHub's runs on 7c1faac, 14 November 2026). So: woken, then a tap.
    const more = page.getByRole("button", { name: "More", exact: true });
    await expect
      .poll(() => more.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber"))).catch(() => false), {
        message: "the reloaded page's code never woke it",
        timeout: 20_000,
      })
      .toBe(true);
    await more.click();
    await expect(page.getByRole("dialog", { name: "More" }), "the reloaded page does not respond to a tap").toBeVisible();
    expect(alerts, "code that failed to arrive raised an alert").toEqual([]);
  });

  for (const which of ["its own code", "all its code"] as const) {
    test(`a page whose code fails while it first loads (${which}) reloads itself once, and then works`, async ({ page }) => {
      const alerts: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
      });
      // /check's own code is what it is sent with that the homepage is not: its form and its words.
      const sent = async (path: string) =>
        new Set([...(await (await page.request.get(path)).text()).matchAll(/<script src="([^"]+)" async=""/g)].map((m) => m[1]));
      const home = await sent("/");
      const own = [...(await sent("/check"))].filter((src) => !home.has(src));
      test.skip(which === "its own code" && own.length === 0, "/check was sent with no code of its own");
      let documents = 0;
      page.on("request", (r) => {
        if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
      });
      // At once, on the first load only: before Next is watching them, so nothing throws and, uncured, that part of the
      // page would stay dead with no error and no report (review, 14 November 2026). All of it: Next never starts.
      await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => {
        const path = new URL(route.request().url()).pathname;
        return documents <= 1 && (which === "all its code" || own.includes(path)) ? route.abort("connectionreset") : route.continue();
      });
      await page.goto("/check");
      await expect.poll(() => documents, { message: "the page did not reload itself", timeout: 25_000 }).toBe(2);
      await expect(page.getByRole("heading", { level: 1 }), "the reloaded page did not open").toContainText("Check any car", { timeout: 20_000 });
      // Its own part works: the box for the chassis number is React's, not the server's lifeless copy.
      await expect
        .poll(() => page.evaluate(() => Object.keys(document.getElementById("vc-vin") ?? {}).some((k) => k.startsWith("__reactFiber"))).catch(() => false), {
          message: "the reloaded page's own part never woke",
          timeout: 15_000,
        })
        .toBe(true);
      expect(await page.evaluate(() => sessionStorage.getItem("sc_chunk_reload")), "the reload was not the site's own cure").not.toBeNull();
      expect(alerts, "a failure cured by one reload raised an alert").toEqual([]);
    });
  }

  // The page's own files, as the server sends them in its HTML, that the homepage is not also sent: its own code.
  async function ownCode(page: Page, path: string): Promise<string[]> {
    const sent = async (p: string) => new Set([...(await (await page.request.get(p)).text()).matchAll(/<script src="([^"]+)" async=""/g)].map((m) => m[1]));
    const home = await sent("/");
    return [...(await sent(path))].filter((src) => !home.has(src));
  }

  /** Holds a request until Next has started on the page and is watching its own files, as when a line dies mid-file. */
  async function untilNextStarted(page: Page): Promise<void> {
    for (let i = 0; i < 150; i++) {
      if (await page.evaluate(() => Boolean((window as unknown as { next?: unknown }).next)).catch(() => false)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  test("a file of the page dropped once while Next is watching it is fetched again by Next: no reload, nothing typed lost", async ({ page }) => {
    // Review of 7c1faac, 15 November 2026: the first-load cure reloaded the page at once, though Next fetches such a
    // file again by itself, and the message a buyer had started to type was gone.
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
    });
    const own = await ownCode(page, "/contact");
    test.skip(own.length === 0, "/contact was sent with no code of its own");
    let documents = 0;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
    });
    let dropped = 0;
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
      if (dropped > 0 || !own.includes(new URL(route.request().url()).pathname)) return route.continue();
      dropped++;
      await untilNextStarted(page);
      return route.abort("connectionreset");
    });
    await page.goto("/contact");
    const message = "I want the Hiace Hummer, can I see it on Saturday?";
    await page.locator('textarea[name="message"]').fill(message);
    await expect
      .poll(() => page.evaluate(() => Object.keys(document.querySelector('textarea[name="message"]') ?? {}).some((k) => k.startsWith("__reactFiber"))).catch(() => false), {
        message: "the contact form never woke after Next fetched its file again",
        timeout: 20_000,
      })
      .toBe(true);
    test.skip(dropped === 0, "The page asked for none of its own files");
    await page.waitForTimeout(1_500);
    expect(documents, "the page reloaded though Next fetched the file again").toBe(1);
    await expect(page.locator('textarea[name="message"]'), "what the buyer typed was lost").toHaveValue(message);
    expect(alerts, "a file fetched again raised an alert").toEqual([]);
  });

  /** Whether the element the selector finds has been woken by React (its mark on the element), on a page that may be loading. */
  const woke = (page: Page, selector: string) =>
    page.evaluate((sel) => Object.keys(document.querySelector(sel) ?? {}).some((k) => k.startsWith("__reactFiber")), selector).catch(() => false);

  test("a file Next is watching that fails twice gives \"One moment…\" and one reload, never the error page or an alert", async ({ page }) => {
    // Review of 7c1faac, 15 November 2026: the first-load cure and the error page's cure both took it, so the buyer saw
    // "Something went wrong" and the managers were alerted for a failure that cured itself.
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
    });
    const own = await ownCode(page, "/check");
    test.skip(own.length === 0, "/check was sent with no code of its own");
    let documents = 0;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
    });
    // The line stays bad until the reloaded page has arrived: Next's own retry of the file fails too.
    let landed = false;
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame() && documents > 1) landed = true;
    });
    // Every one of its own files is held until Next has started and is watching them, then dropped: one let go sooner
    // would fail before Next was watching it, which is the first-load cure's own case, not this one.
    let nextStarted: Promise<void> | null = null;
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
      if (landed || !own.includes(new URL(route.request().url()).pathname)) return route.continue();
      nextStarted ??= untilNextStarted(page);
      await nextStarted;
      return route.abort("connectionreset");
    });
    // The site takes a moment to answer, as on weak data: the cure waits for it, and the page meanwhile is in sight.
    // (Holding the reload instead hid the page: Playwright's reads wait for a page on its way. Review of 666b037.)
    await page.route(/\/api\/up(\?.*)?$/, async (route) => {
      await new Promise((r) => setTimeout(r, 2_500));
      return route.continue();
    });
    await page.goto("/check");
    await expect(page.getByRole("status").filter({ hasText: "One moment…" }), "the buyer was not told to wait a moment while the page cured itself").toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Something went wrong on our side."), "the buyer saw the error page for a failure that was being cured").toHaveCount(0);
    expect(documents, "the page reloaded before the site answered").toBe(1);
    await expect.poll(() => documents, { message: "the page did not reload itself after Next's own retry failed", timeout: 20_000 }).toBe(2);
    await expect.poll(() => woke(page, "#vc-vin"), { message: "the reloaded page never woke", timeout: 20_000 }).toBe(true);
    expect(alerts, "a failure cured by one reload raised an alert").toEqual([]);
  });

  test("a line drop just after Next starts, on the code every page shares, reloads the page once, and it then works", async ({ page }) => {
    // Review of 666b037, 15 November 2026: these files failing while Next watched them, and Next's own retry failing too,
    // left the whole page dead (the form, Chat, Save and the menu never woke) with no reload and no report. Next cannot
    // start a page without them, so no error page can show either.
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
    });
    const shared = rootErrorCode(await (await page.request.get("/contact")).text()).map((f) => f.split("?")[0]);
    expect(shared.length, "the page's own data names no files for the page Next shows when the app itself fails").toBeGreaterThan(0);
    let documents = 0;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
    });
    let landed = false;
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame() && documents > 1) landed = true;
    });
    let nextStarted: Promise<void> | null = null;
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
      if (landed || !shared.includes(new URL(route.request().url()).pathname)) return route.continue();
      nextStarted ??= untilNextStarted(page);
      await nextStarted;
      return route.abort("connectionreset");
    });
    await page.goto("/contact");
    await expect.poll(() => documents, { message: "the page did not reload itself after the code every page shares failed twice", timeout: 30_000 }).toBe(2);
    await expect.poll(() => woke(page, 'textarea[name="message"]'), { message: "the reloaded page never woke", timeout: 20_000 }).toBe(true);
    expect(await page.evaluate(() => sessionStorage.getItem("sc_chunk_reload")), "the reload was not the site's own cure").not.toBeNull();
    expect(alerts, "a failure cured by one reload raised an alert").toEqual([]);
  });

  test("while the site does not answer, \"One moment…\" gives the ways on, keeps asking as long as it takes, and opens the page once the line is back", async ({ page }) => {
    // Review of 666b037, 15 November 2026: the cure stopped asking after ten minutes, and "One moment…", with nothing to
    // tap, then stayed for good once the data came back.
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
    });
    await page.clock.install();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const had = new Set(await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name)));
    let reloaded = false;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) reloaded = true;
    });
    // Signal but no data: the page's new code fails, and the site does not answer, until the line comes back.
    let dead = true;
    await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => (!reloaded && !had.has(route.request().url()) ? route.abort("connectionreset") : route.continue()));
    await page.route(/\/api\/up(\?.*)?$/, (route) => (dead ? route.abort("internetdisconnected") : route.continue()));
    await page.getByRole("navigation", { name: "Start here" }).getByRole("link", { name: /^Check VIN/ }).click();
    const status = page.getByRole("status").filter({ hasText: "One moment…" });
    await expect(status, "the page did not say to wait a moment").toBeVisible({ timeout: 20_000 });
    await expect(status, "the page did not say it cannot reach Sabicars").toContainText("We can't reach Sabicars right now", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Try again" }), "there is no way to try again").toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the homepage" }), "there is no way back to the homepage").toHaveAttribute("href", "/");
    await expect(page.locator('main a[href^="tel:"]').first(), "there is no number to call").toBeVisible();
    await expect(page.getByText("Something went wrong on our side."), "the page blamed the site for a line that answers nothing").toHaveCount(0);
    // Eleven minutes with no answer, on the page's own clock: past the ten minutes after which it used to stop.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    for (let i = 0; i < 22; i++) {
      await page.clock.runFor(30_000);
      await page.waitForTimeout(50);
    }
    expect(reloaded, "the page reloaded while the site did not answer").toBe(false);
    dead = false;
    await page.clock.runFor(31_000);
    await expect.poll(() => reloaded, { message: "the page stopped asking, and did not open once the line was back", timeout: 10_000 }).toBe(true);
    await page.clock.resume();
    await expect(page, "the page that opened is not the one the visitor tapped").toHaveURL(/\/check$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 }), "the page they tapped did not open").toContainText("Check any car", { timeout: 20_000 });
    expect(alerts, "a line that answered nothing raised an alert").toEqual([]);
  });

  test("with signal but no data, a page whose code failed stays readable, and reloads once the site answers", async ({ page }) => {
    // Review of 7c1faac, 15 November 2026: the cure reloaded into a dead line, and the browser's own error page took
    // the place of a page the buyer could read. Now it reloads only when the site answers. The reload meets the dead
    // line too, and the line stays dead for longer than two of the cure's asks: a cure that reloads blind fails here
    // (review of 666b037).
    const own = await ownCode(page, "/check");
    test.skip(own.length === 0, "/check was sent with no code of its own");
    let documents = 0;
    page.on("request", (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
    });
    let deadUntil = 0;
    let reloadAt = 0;
    await page.route("**/*", (route) => {
      const req = route.request();
      const dead = deadUntil > 0 && Date.now() < deadUntil;
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        if (deadUntil && !reloadAt) reloadAt = Date.now();
        // With signal but no data the reload fails too: the browser's own error page.
        return dead ? route.abort("internetdisconnected") : route.continue();
      }
      if (documents > 1) return route.continue();
      const path = new URL(req.url()).pathname;
      if (own.includes(path)) {
        if (!deadUntil) deadUntil = Date.now() + 12_000;
        return route.abort("connectionreset");
      }
      if (dead) return route.abort("internetdisconnected");
      return route.continue();
    });
    await page.goto("/check");
    await expect(page.getByRole("heading", { level: 1 }), "the readable page was lost").toContainText("Check any car");
    await expect.poll(() => documents, { message: "the page did not reload once the site answered again", timeout: 35_000 }).toBe(2);
    expect(reloadAt, "the page reloaded into a line that answers nothing").toBeGreaterThanOrEqual(deadUntil);
    await expect.poll(() => woke(page, "#vc-vin"), { message: "the reloaded page never woke", timeout: 20_000 }).toBe(true);
  });

  for (const which of ["a stylesheet", "its own code"] as const) {
    test(`a page whose ${which === "a stylesheet" ? "stylesheet" : "own code"} fails while its stylesheets are still arriving reloads itself once, and then works`, async ({ page }) => {
      // Review of 666b037, 15 November 2026: the self-heal script runs only once the page's stylesheets have arrived, so
      // it could not hear a file that failed before then: an unstyled page, or /check's box that never woke, with no
      // reload and no report.
      const alerts: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("/api/ops/client-error")) alerts.push(r.postData() ?? "");
      });
      const html = await (await page.request.get("/check")).text();
      const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1].split("?")[0]);
      const own = await ownCode(page, "/check");
      test.skip(sheets.length < 2, "/check has fewer than two stylesheets");
      test.skip(which === "its own code" && own.length === 0, "/check was sent with no code of its own");
      let documents = 0;
      page.on("request", (r) => {
        if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
      });
      // On the first load only: the file fails at once, while the page's other stylesheets take 1.5 s to arrive.
      const failing = which === "a stylesheet" ? [sheets[0]] : own;
      await page.route(/\/_next\/static\/.+\.(js|css)(\?.*)?$/, async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (documents > 1) return route.continue();
        if (failing.includes(path)) return route.abort("connectionreset");
        if (sheets.includes(path)) await new Promise((r) => setTimeout(r, 1_500));
        return route.continue();
      });
      await page.goto("/check");
      await expect.poll(() => documents, { message: "the page did not reload itself", timeout: 25_000 }).toBe(2);
      await expect(page.getByRole("heading", { level: 1 }), "the reloaded page did not open").toContainText("Check any car", { timeout: 20_000 });
      const styled = () =>
        page
          .evaluate(() =>
            [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].every((l) => {
              try {
                return Boolean(l.sheet?.cssRules);
              } catch {
                return false;
              }
            }),
          )
          .catch(() => false);
      await expect.poll(styled, { message: "the reloaded page is not styled", timeout: 15_000 }).toBe(true);
      await expect.poll(() => woke(page, "#vc-vin"), { message: "the reloaded page's own part never woke", timeout: 15_000 }).toBe(true);
      expect(alerts, "a failure cured by one reload raised an alert").toEqual([]);
    });
  }

  test("What do you need? has a door for each of the six things Sabicars does", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "What do you need?" }) }).last();
    for (const [name, href] of [
      [/^Buy a car/, "/vehicles"],
      [/^40% Drive Plan/, "/drive-plan"],
      [/^Check VIN/, "/check"],
      [/^Sell your car/, "/sell"],
      [/^Request a car/, "/find"],
      [/^Earn/, "/partners"],
    ] as const) {
      await expect(section.getByRole("link", { name }), `What do you need? has no ${name} door`).toHaveAttribute("href", href);
    }
    assertNoFaults(faults);
  });

  test("Today at the park, when shown, names the day and links every car", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: /what is new this week|from the park/i }) }).last();
    test.skip((await section.count()) === 0, "A quiet week with no video: the section stays away");
    await expect(section.getByText(/Today at the park · \w+day,? \d{1,2} \w+/), "the section does not name the day").toBeVisible();
    const cars = section.locator('a[href^="/vehicles/"]');
    if (await cars.count()) await expect(cars.first(), "a car in the section does not link to its page").toHaveAttribute("href", /^\/vehicles\/[a-z0-9-]+$/);
    assertNoFaults(faults);
  });

  test("Find your car suggests what is in stock, and always offers to ask", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Find your car" });
    await expect(search, "the homepage has no search field").toBeVisible();
    const options = page.getByRole("listbox", { name: "Suggestions" }).getByRole("option");
    // A budget is read wherever it sits in the sentence, past a year typed before it.
    await search.fill("2018 highlander 30m");
    await expect(options.filter({ hasText: "Cars up to ₦30M" }), "a budget typed after a year is not understood").toHaveCount(1);
    await search.fill("toyota");
    await expect(options.last(), "the last suggestion does not offer Ask Sabicars").toContainText("Ask Sabicars");
    if ((await vehiclesInStockToday(page)) > 0 && (await options.count()) > 1) {
      // A make in stock comes first, and it leads to that make's page.
      await options.first().click();
      await page.waitForURL(/\/buy\/[a-z0-9-]+$|\/hummer-bus$/);
    }
    assertNoFaults(faults);
  });

  test("the Hummer section shows the bus in pictures, with prices and never a head count", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "The home of the Hummer bus." });
    test.skip((await heading.count()) === 0, "No Hummer bus is in stock, so the section is hidden");
    const section = page.locator("section").filter({ has: heading }).last();
    // A small number in stock reads as little choice; the owner asked for the count to go.
    await expect(section, "the Hummer section states how many are in stock").not.toContainText(/\d+\s+in stock/i);
    await expect(section.getByRole("link", { name: /See every Hummer bus/ }), "the Hummer section does not lead to the Hummer page").toHaveAttribute("href", "/hummer-bus");
    // One large photograph and up to three more beneath it.
    const photos = await section.getByRole("img").count();
    expect(photos, "the Hummer section shows no photograph").toBeGreaterThanOrEqual(1);
    expect(photos, "the Hummer section shows more than a main photo and three beneath it").toBeLessThanOrEqual(4);
    assertNoFaults(faults);
  });

  test("Earn shows cars at the park with what one buyer earns on each, and leads to the programme", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /Earn 1\.5% when they buy/ }) }).last();
    for (const promise of ["Free to join", "Paid when they buy", "No recruiting"]) {
      await expect(section.getByText(promise, { exact: true }), `the promise "${promise}" is missing`).toBeVisible();
    }
    await expect(section.getByRole("link", { name: "Get your free link" }), "the way in does not lead to registration").toHaveAttribute("href", "/partners#register");
    await expect(section.getByRole("link", { name: "How it works" }), "the rules are not one tap away").toHaveAttribute("href", "/partners");
    // The examples are real cars in stock, so on an empty showroom they are simply not there.
    const cards = section.getByRole("listitem").filter({ hasText: "You earn" });
    if (await cards.count()) {
      await expect(cards.first().getByRole("link"), "an example does not open its car").toHaveAttribute("href", /^\/vehicles\/[a-z0-9-]+$/);
      await expect(cards.first().locator(".figures").filter({ hasText: /^₦[\d,]+$/ }), "an example shows no amount").toBeVisible();
    }
    assertNoFaults(faults);
  });

  test("the buying guides show as cards with their pictures", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Read before you buy." });
    test.skip((await heading.count()) === 0, "No guide is published, so the section is hidden");
    const cards = page.locator("section").filter({ has: heading }).last().locator('a[href^="/blog/"]');
    await expect(cards.first(), "the guides section shows no article card").toBeVisible();
    await expect(cards.filter({ has: page.locator("img") }).first(), "no guide card on the homepage shows its picture").toBeAttached();
    assertNoFaults(faults);
  });

  test("the homepage shows a car with its price", async ({ page }) => {
    const faults = watchForFaults(page);
    await page.goto("/");
    const inStock = await vehiclesInStockToday(page);
    test.skip(inStock === 0, "The site has no vehicles in stock, so there is no card to check");
    const card = page.getByRole("article").filter({ hasText: /₦[\d,]+|Price on request/ }).first();
    await expect(card, "the homepage shows no vehicle card with a price").toBeAttached();
    await expect(card.getByRole("heading", { level: 3 }), "the vehicle card names no model").not.toBeEmpty();
    await expect(card.getByRole("link").first(), "the vehicle card does not link to the car's page").toHaveAttribute("href", /^\/vehicles\/[a-z0-9-]+$/);
    assertNoFaults(faults);
  });
});
