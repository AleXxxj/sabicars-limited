import { expect, test } from "@playwright/test";
import { assertNoFaults, openFirstVehicle, stockCount, watchForFaults } from "../helpers";

/**
 * A car's page, opened from its card the way a buyer opens it: the name and
 * the price, how it can be paid for, a photograph that really loaded, and
 * the enquiry and viewing forms.
 */
test.describe("A car's page", () => {
  test("shows the car's title and price", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    const { title } = await openFirstVehicle(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading, "the car page shows no title").not.toBeEmpty();
    // The card named it "2016 Toyota Hiace, ₦…"; the page's heading is the model.
    const model = (await heading.innerText()).trim();
    expect(title, `the card said "${title}" but the page is about "${model}"`).toContain(model);
    // The title block is in the page twice (a phone copy and a laptop copy, one hidden at any width): the visible one counts.
    await expect(page.getByText("Price", { exact: true }).filter({ visible: true }).first(), "the car page has no Price label").toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).filter({ visible: true }).first(), "the car page shows no price").toBeVisible();
    assertNoFaults(faults);
  });

  test("says how the car can be paid for", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const price = (await page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).filter({ visible: true }).first().innerText()).trim();
    const status = page.getByText(/This vehicle has been sold|Reserved — a buyer has placed a deposit/);
    if (price === "Price on request") {
      // No price, no plan: the enquiry form is the way to ask.
      await expect(page.getByRole("button", { name: "Chat with seller" }), "a car on request offers no way to reach the seller").toBeVisible();
    } else if (await status.count()) {
      await expect(status, "the car's status note is not shown").toBeVisible();
    } else {
      const plan = page.getByText(/^Your \d+% deposit$/);
      const cash = page.getByText("Full payment only.", { exact: true });
      await expect(plan.or(cash).first(), 'the car page neither offers the Drive Plan nor says "Full payment only."').toBeVisible();
      if (await plan.count()) {
        await expect(page.getByText(/^\d+%, paid by a loan through Autochek$/), "the Drive Plan card does not say what the loan covers").toBeVisible();
        // The estimate is folded away under "Monthly estimate", so the price stays the first thing read.
        await page.locator("summary").filter({ hasText: "Monthly estimate" }).first().click();
        await expect(page.getByText("Estimated monthly repayment"), "the Drive Plan card shows no estimated monthly repayment").toBeVisible();
      }
    }
    assertNoFaults(faults);
  });

  test("has a photograph that really loaded", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // The gallery's main image is the first photograph on the page; a placeholder counts, a broken image does not.
    const photo = page.getByRole("img", { name: /for sale in Lagos|photos coming soon/ }).first();
    await expect(photo, "the car page shows no photograph").toBeVisible();
    await expect
      .poll(async () => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth), { message: "the car's photograph never loaded (naturalWidth stayed 0)", timeout: 20_000 })
      .toBeGreaterThan(0);
    await expect(page.getByText(/^1 \/ \d+$/).first(), "the gallery does not count its photos").toBeVisible();
    assertNoFaults(faults);
  });

  test("offers three ways to enquire on one card, and 'Book a viewing' opens the booking", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // The enquiry is a sheet over the page, opened by the links under the photos; the page itself goes on to similar cars.
    await expect(page.getByRole("heading", { name: /^Interested in the / }), "the enquiry sheet should be closed on arrival").toBeHidden();
    await page.getByRole("link", { name: "leave your number and we call you" }).click();
    await expect(page.getByRole("heading", { name: /^Interested in the / }), "the call-back link did not open the enquiry sheet").toBeVisible();
    // The three ways sit side by side on the card, none hiding another.
    const card = page.locator("#enquiry-card");
    for (const way of ["Call me back", "Ask a question", "Book a viewing"]) {
      await expect(card.getByRole("radio", { name: way }), `the enquiry card has no "${way}" way`).toBeAttached();
    }
    await expect(card.getByRole("button", { name: "Call me back" }), "the card does not open on the call-back").toBeVisible();
    await card.getByText("Ask a question", { exact: true }).click();
    await expect(card.getByRole("button", { name: "Send my question" }), "choosing 'Ask a question' did not show the question form").toBeVisible();
    // "Book a viewing" under the photos opens the sheet on the booking: the day and time picker, not a choice.
    await page.keyboard.press("Escape");
    await expect(card, "Escape did not close the sheet").toBeHidden();
    await page.getByRole("link", { name: "Book a viewing" }).first().click();
    await expect(card.getByText("When would you like to come?"), "'Book a viewing' did not open the day and time picker").toBeVisible();
    await expect(card.getByRole("button", { name: "Book the viewing" }), "the booking has no Book the viewing button").toBeVisible();
    assertNoFaults(faults);
  });

  test("the phone bar stands in for the row, goes at Similar vehicles, and steps aside for the sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The phone bar only exists on phones");
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const bar = page.locator("[data-ask-dock]");
    // Call, Chat, Enquire, and nothing else in the bar. The bar may be slid away (aria-hidden) on arrival, so
    // the roles are looked up hidden or not.
    await expect(bar.getByRole("link", { name: /^Call Sabicars/, includeHidden: true }), "the bar has no Call").toBeAttached();
    await expect(bar.getByRole("button", { name: /^Chat with the seller/, includeHidden: true }), "the bar has no Chat").toBeAttached();
    await expect(bar.getByRole("link", { name: "Enquire", includeHidden: true }), "the bar has no Enquire").toBeAttached();
    await expect(bar, "the bar carries a price, which belongs to the page").not.toContainText("₦");
    // The page's own row sits under the photo, on a phone: reserve, see it, talk to a person.
    const row = page.locator("#primary-actions");
    await expect(row.getByRole("link", { name: "Book a viewing" }), "the row under the photo has no Book a viewing").toBeAttached();
    await expect(row.getByRole("button", { name: "Chat with seller" }), "the row under the photo has no Chat with seller").toBeAttached();
    // On arrival the bar is up, with the three buttons beneath it. As the buttons come out from under it, it steps
    // aside; it is back as soon as the buttons have gone over the top, call-back line or not; once "Similar
    // vehicles" comes into view, it has gone.
    await expect(bar, "the phone bar is not up on arrival").toHaveAttribute("aria-hidden", "false");
    await page.evaluate(() => window.scrollBy(0, document.querySelector("#primary-actions [data-buttons]")!.getBoundingClientRect().top - 200));
    await expect(bar, "the bar stayed up with the three buttons in view").toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect().bottom;
      window.scrollBy(0, document.querySelector("#primary-actions [data-buttons]")!.getBoundingClientRect().bottom - header + 4);
    });
    await expect(page.locator("#primary-actions p"), "the call-back line should still be in view here").toBeInViewport();
    await expect(bar, "the bar did not come back once the buttons had gone").toHaveAttribute("aria-hidden", "false");
    if (await page.locator("#similar").count()) {
      await page.evaluate(() => document.querySelector("#similar")!.scrollIntoView());
      await expect(bar, "the bar is still up at Similar vehicles").toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => window.scrollBy(0, document.querySelector("#primary-actions")!.getBoundingClientRect().bottom + 8));
      await expect(bar, "the bar did not come back above Similar vehicles").toHaveAttribute("aria-hidden", "false");
    }
    // Enquire opens the sheet on "Ask a question"; the bar steps aside behind it and returns when it closes.
    await bar.getByRole("link", { name: "Enquire" }).click();
    const card = page.locator("#enquiry-card");
    await expect(card, "the bar's Enquire did not open the sheet").toBeVisible();
    await expect(card.getByRole("button", { name: "Send my question" }), "the sheet did not open on Ask a question").toBeVisible();
    await expect(bar, "the phone bar stayed up behind the open sheet").toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(bar, "the phone bar did not come back once the sheet closed").toHaveAttribute("aria-hidden", "false");
    assertNoFaults(faults);
  });

  test("'Chat with seller' opens a room with the team, not a question for Sabi", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    await page.getByRole("button", { name: "Chat with seller" }).click();
    const room = page.getByRole("dialog", { name: "Sabicars team" });
    await expect(room, "'Chat with seller' did not open the chat as a room with the team").toBeVisible();
    await expect(room.getByText(/A person replies when free/), "the room does not say a person replies and Sabi only steps in").toBeVisible();
    await expect(room.getByPlaceholder("Write to the team…"), "the room has no message box").toBeVisible();
    // Nothing is sent: a message here would ping the team's phones.
    assertNoFaults(faults);
  });

  test("the calendar file route answers only real viewing references", async ({ request }) => {
    const res = await request.get("/api/viewings/SC-RECEIVED/calendar.ics");
    expect(res.status(), "an unknown reference should be refused with 404").toBe(404);
  });

  test("reaches a person in one tap, and calls back from a number alone", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    // The four facts a buyer reads first sit under the name, before the price.
    await expect(page.getByRole("heading", { level: 1 }), "the car page shows no name").toBeVisible();
    await expect(page.getByText(/Foreign used|Nigerian used|Brand new/).filter({ visible: true }).first(), "the car page does not state the car's condition up top").toBeVisible();
    // One tap to a phone: a tel: link on the page.
    await expect(page.locator('a[href^="tel:"]').first(), "the car page has no call link").toBeAttached();
    // Call me back: one field, the way the enquiry card opens on. Sent the way looksAutomated() recognises
    // a bot, so the server answers with the decoy and writes nothing — a real number here would ring the showroom.
    await page.getByRole("link", { name: "leave your number and we call you" }).click();
    const form = page.locator("#enquiry-card").filter({ has: page.getByRole("button", { name: "Call me back" }) });
    await expect(form, "the car page has no Call me back form").toBeAttached();
    await form.locator('input[name="phone"]').fill("0803 000 0000");
    await form.locator('input[name="website"]').fill("https://example.com");
    await form.getByRole("button", { name: "Call me back" }).click();
    const done = page.getByRole("status").filter({ hasText: /We will call/ });
    await expect(done, "the call-back did not answer").toBeVisible();
    await expect(done, "the bot was not given the decoy reference — was a real call-back saved?").toContainText("RECEIVED");
    assertNoFaults(faults);
  });
});
