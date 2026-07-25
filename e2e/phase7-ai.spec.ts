import { expect, test, type Page } from "@playwright/test";

/*
 * @phase7 e2e: "AI suggest itinerary" — QA 7.4-7.6.
 *
 * The LLM call happens server-side (lib/services/ai.ts), invisible to
 * Playwright's browser-level network interception, so QA 7.4 (happy path,
 * 3-6 valid items) and 7.5 (malformed JSON) — which need control over the
 * provider's response body — are covered precisely at the unit level
 * (lib/services/ai.test.ts, mocking the Anthropic SDK at the module
 * boundary). This suite exercises the two paths genuinely observable
 * end-to-end without any mocking: no `LLM_API_KEY` is configured in this
 * environment, so every call takes the real `AiUnavailableError` fallback
 * path (QA 7.5's "graceful, no crash, manual add still works" outcome) —
 * and quota enforcement (QA 7.6) is real, not simulated, since
 * `checkAndConsumeQuota` runs and increments before the provider is ever
 * called.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

async function bookTripAndOpenItinerary(page: Page) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "LIS");
  await page.getByLabel("Departure").fill(isoDaysFromNow(15));
  await page.getByTestId("search-flights-submit").click();
  await page.getByTestId("flight-card").first().click();
  await page.getByTestId("select-flight-submit").click();
  await page.waitForURL(/\/search\/hotels$/);
  await page.getByTestId("skip-hotels-submit").click();
  await page.waitForURL(/\/trip\/summary$/);
  await page.getByTestId("continue-to-checkout").click();
  await page.waitForURL(/\/trip\/checkout$/);
  await page.getByTestId("confirm-booking-submit").click();
  await page.waitForURL(/\/trip\/confirmation\//);

  const exported = await page.request.get("/api/export");
  const body = await exported.json();
  await page.goto(`/trips/${body.trips[0].id}/itinerary`);
}

test.describe("@phase7 AI suggest itinerary", () => {
  test("7.5 provider unavailable is graceful — friendly message, no crash", async ({
    page,
  }) => {
    await bookTripAndOpenItinerary(page);
    await page.getByTestId("ai-suggest-button").click();
    await expect(page.getByTestId("ai-suggest-loading")).toBeVisible();
    await expect(page.getByTestId("ai-suggest-unavailable")).toBeVisible();
    await expect(page.getByTestId("ai-suggest-unavailable")).toContainText(
      /travel muse is resting/i,
    );
  });

  test("manual itinerary authoring is unaffected by an AI failure", async ({ page }) => {
    await bookTripAndOpenItinerary(page);
    await page.getByTestId("ai-suggest-button").click();
    await expect(page.getByTestId("ai-suggest-unavailable")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByTestId("itinerary-add-button").first().click();
    await page.getByTestId("add-itinerary-title").fill("Manually added");
    await page.getByTestId("add-itinerary-submit").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(1);
  });

  test("7.6 quota exceeded after 5 calls: the 6th is denied before any provider call", async ({
    page,
  }) => {
    await bookTripAndOpenItinerary(page);

    for (let i = 0; i < 5; i++) {
      await page.getByTestId("ai-suggest-button").click();
      await expect(page.getByTestId("ai-suggest-unavailable")).toBeVisible();
      await page.keyboard.press("Escape");
    }

    await page.getByTestId("ai-suggest-button").click();
    await expect(page.getByTestId("ai-suggest-quota")).toBeVisible();
    await expect(page.getByTestId("ai-suggest-quota")).toContainText(/quota|tomorrow/i);
  });
});
