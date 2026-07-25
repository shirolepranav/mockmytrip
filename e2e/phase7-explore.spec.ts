import { expect, test, type Page } from "@playwright/test";

/*
 * @phase7 e2e: Explore (real POIs) — QA 7.12-7.16 from docs/IMPLEMENTATION_PLAN.md.
 * Paris (CDG) has committed fixture data (data/raw/pois/*\/paris.json), seeded
 * into the dev DB, so it stands in as the "seeded city" throughout.
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

async function bookTripAndOpenExplore(page: Page): Promise<string> {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "CDG");
  await page.getByLabel("Departure").fill(isoDaysFromNow(20));
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
  const tripId = body.trips[0].id as string;
  await page.goto(`/trips/${tripId}/explore`);
  return tripId;
}

test.describe("@phase7 Explore (real POIs)", () => {
  test("7.12 renders real POIs, tabs filter, and no fake price/rating ever appears", async ({
    page,
  }) => {
    await bookTripAndOpenExplore(page);
    await expect(page.getByTestId("poi-card").first()).toBeVisible();
    const allCount = await page.getByTestId("poi-card").count();
    expect(allCount).toBeGreaterThan(0);
    await expect(page.getByTestId("poi-real-place-chip").first()).toBeVisible();

    await page.getByTestId("explore-tab-museums").click();
    const museumCount = await page.getByTestId("poi-card").count();
    expect(museumCount).toBeLessThanOrEqual(allCount);
    for (const card of await page.getByTestId("poi-card").all()) {
      const text = (await card.textContent()) ?? "";
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/\d(\.\d)?\s*(stars?|\/\s*5)/i);
    }

    await page.getByTestId("explore-tab-all").click();
    await expect(page.getByTestId("poi-card")).toHaveCount(allCount);
  });

  test("7.13 an unseeded city shows a friendly state suggesting the nearest seeded city", async ({
    page,
  }) => {
    await page.goto("/explore/Nowhereville");
    await expect(page.getByTestId("explore-unseeded")).toBeVisible();
  });

  test("7.14 adding a POI to day 2 persists poi_id, retrievable via export", async ({
    page,
  }) => {
    const tripId = await bookTripAndOpenExplore(page);
    await page.getByTestId("explore-poi-card-button").first().click();
    await expect(page.getByTestId("poi-detail-sheet")).toBeVisible();
    await page.getByTestId("poi-detail-add-to-itinerary").click();
    await expect(page.getByTestId("add-from-explore-sheet")).toBeVisible();
    await page.getByTestId("add-from-explore-day-1").click();
    await page.getByTestId("add-from-explore-confirm").click();
    await expect(page.getByTestId("add-from-explore-sheet")).toBeHidden();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    const items = body.itineraryItems as { dayIndex: number; poiId: string | null }[];
    expect(items).toHaveLength(1);
    expect(items[0].dayIndex).toBe(1);
    expect(items[0].poiId).not.toBeNull();
    void tripId;
  });

  test("7.15 itinerary export: print view and PDF download both work", async ({ page }) => {
    const tripId = await bookTripAndOpenExplore(page);
    await page.getByTestId("explore-poi-card-button").first().click();
    await page.getByTestId("poi-detail-add-to-itinerary").click();
    await page.getByTestId("add-from-explore-confirm").click();
    await expect(page.getByTestId("add-from-explore-sheet")).toBeHidden();

    await page.goto(`/trips/${tripId}/itinerary/print`);
    await expect(page.getByTestId("itinerary-print-day").first()).toBeVisible();
    await expect(page.getByTestId("itinerary-print-footer")).toContainText(/SIMULATION/i);

    const pdfResponse = await page.request.get(`/api/itinerary/${tripId}/pdf`);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  });

  test("7.16 attribution is shown on both the Explore grid and the POI detail sheet", async ({
    page,
  }) => {
    await bookTripAndOpenExplore(page);
    await expect(page.getByTestId("explore-attribution-footer")).toContainText(
      /OpenStreetMap|Wikidata|Wikivoyage/i,
    );
    await page.getByTestId("explore-poi-card-button").first().click();
    const sheetAttribution = page
      .getByTestId("poi-detail-sheet")
      .getByTestId("poi-attribution");
    await expect(sheetAttribution).toBeVisible();
    await expect(sheetAttribution).not.toBeEmpty();
  });
});
