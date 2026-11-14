import { expect, test, type Page } from "@playwright/test";
import { CARS_NAV, MAIN_NAV, TAB_BAR, moreItemsOn } from "@/lib/navigation";
import { assertNoFaults, watchForFaults } from "../helpers";

/**
 * The homepage, as a buyer arriving from a video sees it: the headline, the
 * ways in, the Drive Plan question, and a car with a price on it.
 */

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

  test("a hero video, when one is set and plays, can be stopped and the slides come back", async ({ page }) => {
    // Sabicars' own errors only: YouTube's player logs its own, inside its frame, and they are not the site's.
    const theirs = /youtube|ytimg|googlevideo|google\.com|gstatic|doubleclick/;
    const own: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !theirs.test(m.location().url) && !theirs.test(m.text())) own.push(m.text());
    });
    page.on("pageerror", (e) => {
      if (!theirs.test(e.stack ?? e.message)) own.push(e.message);
    });
    page.on("response", (r) => {
      if (r.status() >= 500 && !theirs.test(r.url())) own.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/");
    const controls = page.getByRole("group", { name: "Photos of our cars" });
    const player = page.locator('iframe[title="Sabicars showcase video"], .hh-video video');
    test.skip((await player.count()) === 0, "No hero video is set, or this connection is too slow for one");
    const stop = controls.getByRole("button", { name: "Stop the video" });
    // YouTube may not play at all in a test browser; the hero then keeps its photos, which is the design.
    const played = await stop.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false);
    test.skip(!played, "The video did not start in this browser; the photos stay, as designed");
    await stop.click();
    await expect(player, "the video is still on the page after it was stopped").toHaveCount(0);
    // The slides carry on from wherever they were: while YouTube was still loading, they may have moved on.
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides did not come back after the video was stopped").toHaveCount(1);
    expect(own, "the page had errors of its own while the video played").toEqual([]);
  });

  test("a hero video stops for good when the visitor scrolls past it, and the slides are there on the way back", async ({ page }) => {
    await page.goto("/");
    const controls = page.getByRole("group", { name: "Photos of our cars" });
    const player = page.locator('iframe[title="Sabicars showcase video"], .hh-video video');
    test.skip((await player.count()) === 0, "No hero video is set, or this connection is too slow for one");
    const stop = controls.getByRole("button", { name: "Stop the video" });
    const played = await stop.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false);
    test.skip(!played, "The video did not start in this browser; the photos stay, as designed");
    // Down past the hero, a moment there, and back up, as a visitor would.
    await page.getByRole("heading", { name: "What do you need?" }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 1600);
    await expect(player, "the video kept playing after the hero was scrolled out of sight").toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(controls.getByRole("button", { name: /40% Drive Plan/ }), "the slides are not there on the way back").toHaveCount(1);
    await expect(stop, "the video started again on the way back").toHaveCount(0);
  });

  test("on a slow connection a hero video waits for its Watch video button, then plays", async ({ page }) => {
    // Chrome rates many Lagos connections "3g": there the video must not start by itself, nor use data unasked.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "connection", { configurable: true, value: { effectiveType: "3g", saveData: false } }),
    );
    await page.goto("/");
    const controls = page.getByRole("group", { name: "Photos of our cars" });
    const watch = controls.getByRole("button", { name: "Watch video" });
    const offered = await watch.waitFor({ state: "visible", timeout: 8_000 }).then(() => true, () => false);
    test.skip(!offered, "No hero video is set");
    const player = page.locator('iframe[title="Sabicars showcase video"], .hh-video video');
    await expect(player, "the video started by itself on a slow connection").toHaveCount(0);
    await watch.click();
    await expect(player, "asking for the video did not load it").toHaveCount(1);
    const stop = controls.getByRole("button", { name: "Stop the video" });
    const played = await stop.waitFor({ state: "visible", timeout: 25_000 }).then(() => true, () => false);
    test.skip(!played, "The video did not start in this browser; the photos stay, as designed");
    await stop.click();
    await expect(player, "the video is still on the page after it was stopped").toHaveCount(0);
    await expect(controls.getByRole("button", { name: /Watch video|Loading video/ }), "the button is back after the video was watched").toHaveCount(0);
  });

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
