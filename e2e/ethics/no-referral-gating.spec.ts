import { expect, test, type Page } from "@playwright/test";

/*
 * Permanent ethics guard (IMPLEMENTATION_PLAN Phase 9 task 11, golden rule
 * #8): sharing/inviting must never gate a feature or reward. The primary
 * enforcement is the static source grep (scripts/check-no-referral-gating.mjs,
 * `npm run lint:ethics`) — this is a thin DOM smoke test on top of it,
 * checking the actual rendered copy on the surfaces most likely to carry
 * growth-mechanic language. Required CI check on every commit from Phase 9
 * onward — also tagged @phase9 so it's part of this phase's own regression run.
 */

const BANNED_COPY_PATTERN =
  /invite[^.]{0,60}(unlock|to earn|to get)|refer a friend|share[^.]{0,40}unlock/i;

const JFK_LIS_NEXT_MONTH = "2026-08-15";

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

async function bookTrip(page: Page) {
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
  await page.getByTestId("confirm-booking-submit").click();
  await page.waitForURL(/\/trip\/confirmation\//);
}

async function tripId(page: Page): Promise<string> {
  const exported = await page.request.get("/api/export");
  const body = await exported.json();
  return body.trips[0].id as string;
}

test.describe("@phase9 @ethics no referral gating", () => {
  test("the share sheet never gates anything behind inviting or sharing", async ({ page }) => {
    await bookTrip(page);
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    await page.getByTestId("open-share-sheet").click();
    const text = await page.getByTestId("share-sheet").innerText();
    expect(text).not.toMatch(BANNED_COPY_PATTERN);
  });

  test("the public shared page never gates anything behind inviting or sharing", async ({ page }) => {
    await bookTrip(page);
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    await page.getByTestId("open-share-sheet").click();
    await page.getByLabel("Can add ideas").check();
    await page.getByTestId("generate-share-link").click();
    const row = page.getByTestId("share-link-row").first();
    await expect(row).toBeVisible();
    const rowText = await row.locator("span").first().textContent();
    const token = rowText?.replace("/s/", "").trim();

    await page.goto(`/s/${token}`);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(BANNED_COPY_PATTERN);
  });

  test("the Settings sharing card never gates anything behind inviting or sharing", async ({
    page,
  }) => {
    await page.goto("/settings");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(BANNED_COPY_PATTERN);
  });
});
