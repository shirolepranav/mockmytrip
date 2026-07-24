import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import blocklist from "../data/brand-blocklist.json";

/*
 * @phase4 e2e: hotel search → results → detail → select → trip summary, the
 * full happy path plus edge cases from docs/IMPLEMENTATION_PLAN.md QA 4.1–4.10.
 */

const JFK_LIS_NEXT_MONTH = "2026-08-15";
const LISBON_RESULTS_URL =
  "/search/hotels/results?city=Lisbon&country=PT&checkin=2026-08-15&checkout=2026-08-19&guests=2&rooms=1";

/** Fill an autocomplete field and pick its first (fuzzy-matched) suggestion. */
async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

/** Search JFK→Lisbon and select the first flight, landing on /search/hotels. */
async function selectFirstFlight(page: Page) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "LIS");
  await page.getByLabel("Departure").fill(JFK_LIS_NEXT_MONTH);
  await page.getByTestId("search-flights-submit").click();
  await page.getByTestId("flight-card").first().click();
  await expect(page.getByTestId("select-flight-submit")).toBeVisible();
  await page.getByTestId("select-flight-submit").click();
  await page.waitForURL(/\/search\/hotels$/);
}

test.describe("@phase4 hotel search & trip summary", () => {
  test("4.1 arriving from flight select prefills destination and dates", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await expect(
      page.getByRole("combobox", { name: /Where are you staying/i }),
    ).toHaveValue(/Lisbon/);
    const checkin = await page.getByLabel("Check-in").inputValue();
    expect(checkin.length).toBeGreaterThan(0);
    const checkout = await page.getByLabel("Check-out").inputValue();
    expect(checkout > checkin).toBe(true);
  });

  test("4.2 checkout <= checkin is blocked inline", async ({ page }) => {
    await selectFirstFlight(page);
    const checkin = await page.getByLabel("Check-in").inputValue();
    await page.getByLabel("Check-out").fill(checkin);
    await page.getByTestId("search-hotels-submit").click();

    await expect(
      page.getByText("Check-out must be after check-in"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/search\/hotels$/);
  });

  test("4.3 hotel results for Lisbon: 8-20 fictional hotels, no real brand names", async ({
    page,
  }) => {
    // Hotel-only isn't allowed (task 6) — a flight draft must exist first.
    await selectFirstFlight(page);
    await page.goto(LISBON_RESULTS_URL);
    const cards = page.getByTestId("hotel-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(20);

    // Scan only the rendered hotel names (not surrounding UI copy) so a
    // short blocklist token can't false-positive against unrelated text.
    const names = (await page.getByTestId("hotel-name").allTextContents()).map(
      (name) => ` ${name.toLowerCase()} `,
    );
    const blockedHotelBrands: string[] = [...blocklist.hotels];
    for (const name of names) {
      for (const brand of blockedHotelBrands) {
        expect(name.includes(brand)).toBe(false);
      }
    }
  });

  test("4.4 identical search twice returns identical hotels/prices (determinism)", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await page.goto(LISBON_RESULTS_URL);
    const first = await page.getByTestId("hotel-card").allTextContents();
    await page.goto(LISBON_RESULTS_URL);
    const second = await page.getByTestId("hotel-card").allTextContents();
    expect(second).toEqual(first);
  });

  test("4.5 select hotel → summary: both segments listed, totals correct", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await page.getByTestId("search-hotels-submit").click();
    await page.getByTestId("hotel-card").first().click();
    await expect(page.getByTestId("select-hotel-submit")).toBeVisible();
    await page.getByTestId("select-hotel-submit").click();
    await page.waitForURL(/\/trip\/summary$/);

    const draftResponse = await page.request.get("/api/export");
    const draftBody = await draftResponse.json();
    const draftJson = draftBody.drafts[0].draftJson;
    expect(draftJson.flight).toBeTruthy();
    expect(draftJson.hotel).toBeTruthy();

    const expectedTotalCents = draftJson.flight.priceCents + draftJson.hotel.totalCents;
    const expectedDollars = Math.round(expectedTotalCents / 100);

    const grandTotalText = await page.getByTestId("trip-grand-total").innerText();
    const savedText = await page.getByTestId("trip-total-saved").innerText();
    const grandTotalDigits = Number(grandTotalText.replace(/[^0-9]/g, ""));
    const savedDigits = Number(savedText.replace(/[^0-9]/g, ""));

    expect(grandTotalDigits).toBe(expectedDollars);
    expect(savedDigits).toBe(expectedDollars);
    await expect(page.getByText("$0.00")).toBeVisible();
  });

  test("4.6 edit flight from summary returns to results with the prior query; reselecting updates the summary", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await page.getByTestId("skip-hotels-submit").click();
    await page.waitForURL(/\/trip\/summary$/);

    const before = await page.request.get("/api/export");
    const beforeBody = await before.json();
    const originalFlightId = beforeBody.drafts[0].draftJson.flight.id;

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(/\/search\/flights\/results\?.*o=JFK.*d=LIS/);
    const cards = page.getByTestId("flight-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    await cards.nth(1).click();
    await page.getByTestId("select-flight-submit").click();
    await page.waitForURL(/\/search\/hotels$/);

    await page.goto("/trip/summary");
    const after = await page.request.get("/api/export");
    const afterBody = await after.json();
    expect(afterBody.drafts[0].draftJson.flight.id).not.toBe(originalFlightId);
  });

  test("4.7 skip hotels: summary shows flight-only, checkout still allowed", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await page.getByTestId("skip-hotels-submit").click();
    await page.waitForURL(/\/trip\/summary$/);

    await expect(page.getByText("No stay added yet")).toBeVisible();
    await expect(page.getByTestId("continue-to-checkout")).toBeVisible();
    await expect(page.getByTestId("continue-to-checkout")).toHaveAttribute(
      "href",
      "/trip/checkout",
    );
  });

  test("4.8 direct-nav to summary with an empty draft redirects to flight search", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/trip/summary");
    await expect(page).toHaveURL(/\/search\/flights/);
    await expect(page.getByText(/Pick a flight first/i)).toBeVisible();
    await context.close();
  });

  test("4.9 auto-title is sensible, editable, and persists", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    await page.getByTestId("skip-hotels-submit").click();
    await page.waitForURL(/\/trip\/summary$/);

    const titleInput = page.getByTestId("trip-title-input");
    await expect(titleInput).toHaveValue("Trip to Lisbon");

    await titleInput.fill("My custom Lisbon trip");
    await titleInput.blur();
    await page.waitForURL(/\/trip\/summary$/);

    await page.reload();
    await expect(page.getByTestId("trip-title-input")).toHaveValue(
      "My custom Lisbon trip",
    );
  });

  test("4.10 viewports: no horizontal scroll, 44px targets, axe clean", async ({
    page,
  }) => {
    await selectFirstFlight(page);
    for (const route of [
      "/search/hotels",
      LISBON_RESULTS_URL,
      "/trip/summary",
    ]) {
      await page.goto(route);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll).toBe(false);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (violation) => violation.impact === "critical",
      );
      expect(critical, `${route}: ${JSON.stringify(critical, null, 2)}`).toEqual(
        [],
      );
    }

    await page.goto("/search/hotels");
    const box = await page.getByTestId("search-hotels-submit").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
