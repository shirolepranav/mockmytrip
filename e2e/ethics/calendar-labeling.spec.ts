import { expect, test, type Page } from "@playwright/test";

/*
 * Permanent ethics guard (IMPLEMENTATION_PLAN Phase 9 task 11, golden rule
 * #9): .ics exports must self-label as pretend, open with the simulation
 * disclaimer, and never mislead a viewer's calendar into showing Busy.
 * Required CI check on every commit from Phase 9 onward — also tagged
 * @phase9 so it's part of this phase's own regression run.
 */

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

/*
 * The first booking in this browser context flips `hasFirstBoardingPass()`
 * (lib/pwa/install-prompt-state.ts), so the very next navigation away from
 * the confirmation page auto-opens the contextual install-prompt sheet
 * (components/install-prompt.tsx) — on Playwright's iPhone/iPad device
 * presets specifically, since their emulated user-agent string matches
 * `isIosSafari()`'s check even though the engine is Chromium underneath.
 * Its backdrop then intercepts clicks on whatever the test does next.
 *
 * Pre-seed the same "already dismissed" localStorage key the app itself
 * writes on a real dismissal (recordDismissal() in that file), via
 * addInitScript so it's set before any page script runs on every
 * navigation in this context. This has to be proactive, not a reactive
 * "click dismiss if visible right now" check — that raced the sheet's own
 * mount timing and was flaky in CI (passed locally, ~20% failure rate on
 * GitHub's runners) even though it never flaked locally.
 */
async function suppressInstallPrompt(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wanderlost.install-prompt-dismissed-at",
      String(Date.now()),
    );
  });
}

test.describe("@phase9 @ethics calendar labeling", () => {
  test("the .ics export self-labels as pretend, opens with the disclaimer, and is Free/Tentative", async ({
    page,
  }) => {
    await bookTrip(page);
    const trip = await tripId(page);

    const response = await page.request.get(`/api/calendar/${trip}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    expect(response.headers()["content-disposition"]).toContain(".ics");

    const body = await response.text();
    expect(body).toMatch(/SUMMARY:.*\(Pretend\)/);

    const descriptionLine = body
      .replace(/\r\n /g, "") // unfold RFC 5545 continuation lines
      .split("\r\n")
      .find((line) => line.startsWith("DESCRIPTION:"));
    expect(descriptionLine).toBeDefined();
    expect(descriptionLine).toMatch(/^DESCRIPTION:This is a SIMULATED trip/);

    expect(body).toContain("TRANSP:TRANSPARENT");
    expect(body).toContain("STATUS:TENTATIVE");
    expect(body).not.toContain("ORGANIZER");
    expect(body).not.toContain("ATTENDEE");
    expect(body.toLowerCase()).not.toContain("oauth");
  });

  test("no calendar OAuth or read-access flow is ever requested from the UI", async ({ page }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page);
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);

    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));
    await page.getByTestId("add-to-calendar-button").click();
    await page.waitForTimeout(500);
    expect(requestUrls.some((url) => /accounts\.google\.com|oauth/i.test(url))).toBe(false);
  });
});
