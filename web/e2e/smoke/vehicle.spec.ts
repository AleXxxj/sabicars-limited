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
    await expect(page.getByText("Price", { exact: true }).first(), "the car page has no Price label").toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).first(), "the car page shows no price").toBeVisible();
    assertNoFaults(faults);
  });

  test("says how the car can be paid for", async ({ page }) => {
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const price = (await page.locator("p").filter({ hasText: /^(₦[\d,]+|Price on request)$/ }).first().innerText()).trim();
    const status = page.getByText(/This vehicle has been sold|Reserved — a buyer has placed a deposit/);
    if (price === "Price on request") {
      // No price, no plan: the enquiry form is the way to ask.
      await expect(page.getByRole("link", { name: "Enquire about this vehicle" }), "a car on request offers no way to enquire").toBeVisible();
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
    // The enquiry is a sheet over the page, opened by the button under the photos; the page itself goes on to similar cars.
    await expect(page.getByRole("heading", { name: /^Interested in the / }), "the enquiry sheet should be closed on arrival").toBeHidden();
    await page.getByRole("link", { name: "Enquire about this vehicle" }).click();
    await expect(page.getByRole("heading", { name: /^Interested in the / }), "the Enquire button did not open the enquiry sheet").toBeVisible();
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

  test("the phone bar steps aside while the page's own buttons or the enquiry card are on screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The phone bar only exists on phones");
    const faults = watchForFaults(page);
    test.skip((await stockCount(page)) === 0, "The site has no vehicles in stock");
    await openFirstVehicle(page);
    const bar = page.locator("[data-ask-dock]");
    await expect(bar, "the car page has no phone bar").toBeAttached();
    // Under the photos, the real buttons are on screen: the bar's "Enquire" would be a second one.
    await page.locator("#primary-actions").scrollIntoViewIfNeeded();
    await expect(bar, "the phone bar stayed over the page's own Enquire button").toHaveAttribute("aria-hidden", "true");
    // Just past the buttons, reading on, it is the way to act without scrolling back. (The top of the page is
    // no test: a car without photos shows its buttons on the first screen, and the bar rightly stays away.)
    await page.evaluate(() => {
      const buttons = document.getElementById("primary-actions")!.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + buttons.bottom + 120);
    });
    await expect(bar, "the phone bar did not come back once the buttons left the screen").toHaveAttribute("aria-hidden", "false");
    // With the enquiry sheet open over the page, a shortcut to it has no job.
    await bar.getByRole("link", { name: "Enquire" }).click();
    await expect(page.locator("#enquiry-card"), "the bar's Enquire did not open the sheet").toBeVisible();
    await expect(bar, "the phone bar stayed up behind the open sheet").toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(bar, "the phone bar did not come back once the sheet closed").toHaveAttribute("aria-hidden", "false");
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
    await expect(page.getByText(/Foreign used|Nigerian used|Brand new/).first(), "the car page does not state the car's condition up top").toBeVisible();
    // One tap to a phone: a tel: link on the page.
    await expect(page.locator('a[href^="tel:"]').first(), "the car page has no call link").toBeAttached();
    // Call me back: one field, the way the enquiry card opens on. Sent the way looksAutomated() recognises
    // a bot, so the server answers with the decoy and writes nothing — a real number here would ring the showroom.
    await page.getByRole("link", { name: "Enquire about this vehicle" }).click();
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
