import { expect, test, type Page } from "@playwright/test";

/*
 * Permanent ethics guard (IMPLEMENTATION_PLAN Phase 5 task 8, golden rule
 * #1): checkout + confirmation must NEVER contain a payment/card/billing
 * input or a payment SDK script. Required CI check on every commit from
 * Phase 5 onward — also tagged @phase5 so it's part of this phase's own
 * regression run.
 */

const BANNED_FIELD_PATTERN = /card|cc-|cvv|cvc|billing|expiry|iban|pay/i;
const PAYMENT_SDK_PATTERN =
  /js\.stripe\.com|paypal\.com\/sdk|checkout\.com|braintreegateway|squareup\.com|adyen\.com/i;

const JFK_LIS_NEXT_MONTH = "2026-08-15";

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

async function arriveAtCheckout(page: Page) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "LIS");
  await page.getByLabel("Departure").fill(JFK_LIS_NEXT_MONTH);
  await page.getByTestId("search-flights-submit").click();
  await page.getByTestId("flight-card").first().click();
  await page.getByTestId("select-flight-submit").click();
  await page.waitForURL(/\/search\/hotels$/);
  await page.getByTestId("skip-hotels-submit").click();
  await page.waitForURL(/\/trip\/summary$/);
  await page.getByTestId("continue-to-checkout").click();
  await page.waitForURL(/\/trip\/checkout$/);
}

async function assertNoPaymentSurface(page: Page) {
  const fields = await page.locator("input, select, textarea").all();
  for (const field of fields) {
    const name = (await field.getAttribute("name")) ?? "";
    const id = (await field.getAttribute("id")) ?? "";
    const autocomplete = (await field.getAttribute("autocomplete")) ?? "";
    for (const value of [name, id, autocomplete]) {
      expect(
        value,
        `field name/id/autocomplete "${value}" looks payment-related`,
      ).not.toMatch(BANNED_FIELD_PATTERN);
    }
  }

  const scripts = await page.locator("script[src]").all();
  for (const script of scripts) {
    const src = (await script.getAttribute("src")) ?? "";
    expect(src, `script src "${src}" looks like a payment SDK`).not.toMatch(
      PAYMENT_SDK_PATTERN,
    );
  }
}

test.describe("@phase5 @ethics no payment fields", () => {
  test("checkout has zero payment-adjacent inputs or SDK scripts", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await assertNoPaymentSurface(page);
  });

  test("confirmation page has zero payment-adjacent inputs or SDK scripts", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);
    await assertNoPaymentSurface(page);
  });
});
