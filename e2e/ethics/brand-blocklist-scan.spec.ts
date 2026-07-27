import { expect, test, type Page } from "@playwright/test";
import blocklist from "../../data/brand-blocklist.json";

/*
 * @ethics @phase10: standing brand-blocklist DOM scan (golden rule #4).
 * The engine-level blocklist is unit-tested exhaustively in
 * lib/engine/engine.test.ts and spot-checked for hotel cards in
 * e2e/phase4-hotels.spec.ts, but CI's phase-scoped e2e job only runs the
 * *current* phase's tag — once CURRENT_PHASE_TAG moves past @phase4, that
 * spot-check stops running in CI entirely. This spec lives in e2e/ethics/
 * so it rides the same @ethics grep that runs on every commit, giving the
 * name-generator collision check a permanent home.
 *
 * Scoped deliberately to the two surfaces where the synthetic engine
 * actually renders generated names (flight/hotel result cards) — not
 * hand-authored prose pages (About/Privacy/landing). Several blocklist
 * tokens are short, common English/geography substrings ("delta", "azul",
 * "ana ", "ritz", "klm"); scanning arbitrary body copy against them would
 * produce false positives with no real ethics signal. Card text, by
 * contrast, is entirely generator output (times, prices, codes, airline/
 * hotel names) with no free-form prose to collide with.
 */

const FLIGHT_ROUTES = [
  "/search/flights/results?o=JFK&d=LHR&depart=2026-09-01&pax=1&cabin=economy",
  "/search/flights/results?o=JFK&d=NRT&depart=2026-09-15&pax=2&cabin=economy",
  "/search/flights/results?o=LAX&d=CDG&depart=2026-10-01&pax=1&cabin=economy",
];

const HOTEL_ROUTES = [
  "/search/hotels/results?city=Lisbon&country=PT&checkin=2026-08-15&checkout=2026-08-19&guests=2&rooms=1",
  "/search/hotels/results?city=Tokyo&country=JP&checkin=2026-09-16&checkout=2026-09-20&guests=2&rooms=1",
  "/search/hotels/results?city=Paris&country=FR&checkin=2026-10-02&checkout=2026-10-06&guests=1&rooms=1",
];

/** Fill an autocomplete field and pick its first (fuzzy-matched) suggestion. */
async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

/** Search JFK→Lisbon and select the first flight — hotel results require an
 *  existing flight draft in session (lib/hotel-guard.ts). */
async function establishFlightDraft(page: Page) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "LIS");
  await page.getByLabel("Departure").fill("2026-08-15");
  await page.getByTestId("search-flights-submit").click();
  await page.getByTestId("flight-card").first().click();
  await expect(page.getByTestId("select-flight-submit")).toBeVisible();
  await page.getByTestId("select-flight-submit").click();
  await page.waitForURL(/\/search\/hotels$/);
}

test.describe("@phase10 @ethics brand blocklist scan", () => {
  test("flight result cards contain no real airline brand names", async ({ page }) => {
    const blockedAirlines: string[] = blocklist.airlines;
    for (const url of FLIGHT_ROUTES) {
      await page.goto(url);
      const cards = page.getByTestId("flight-card");
      await expect(cards.first()).toBeVisible();
      const texts = (await cards.allTextContents()).map((t) => ` ${t.toLowerCase()} `);
      for (const text of texts) {
        for (const brand of blockedAirlines) {
          expect(text.includes(brand), `"${brand}" found in flight card on ${url}`).toBe(false);
        }
      }
    }
  });

  test("hotel result cards contain no real hotel brand names", async ({ page }) => {
    await establishFlightDraft(page);
    const blockedHotels: string[] = blocklist.hotels;
    for (const url of HOTEL_ROUTES) {
      await page.goto(url);
      const names = page.getByTestId("hotel-name");
      await expect(names.first()).toBeVisible();
      const texts = (await names.allTextContents()).map((t) => ` ${t.toLowerCase()} `);
      for (const text of texts) {
        for (const brand of blockedHotels) {
          expect(text.includes(brand), `"${brand}" found in hotel name on ${url}`).toBe(false);
        }
      }
    }
  });
});
