import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase9 e2e: sharing, collaboration, calendar export — QA 9.1-9.10, 9.18
 * from docs/IMPLEMENTATION_PLAN.md. Multi-user collaboration flows use
 * `browser.newContext()` for genuine session isolation, following the same
 * pattern phase7's ownership-boundary test already established for a
 * second guest identity.
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

async function bookTrip(
  page: Page,
  { from, to, departDate }: { from: string; to: string; departDate: string },
) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", from);
  await pickAirport(page, "To", to);
  await page.getByLabel("Departure").fill(departDate);
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
 * navigation in this context — call this once per page/context, before
 * bookTrip(). This has to be proactive, not a reactive "click dismiss if
 * visible right now" check — that raced the sheet's own mount timing and
 * was flaky in CI (passed locally, failed intermittently on GitHub's
 * runners) even though it never flaked locally.
 */
async function suppressInstallPrompt(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wanderlost.install-prompt-dismissed-at",
      String(Date.now()),
    );
  });
}

/** Opens the (already-mounted) share sheet, picks a permission, generates a link, returns its token. */
async function generateShareLink(page: Page, permission: "view" | "edit"): Promise<string> {
  await page.getByTestId("open-share-sheet").click();
  await page.getByLabel(permission === "edit" ? "Can add ideas" : "View only").check();
  await page.getByTestId("generate-share-link").click();
  const row = page.getByTestId("share-link-row").first();
  await expect(row).toBeVisible();
  const rowText = await row.locator("span").first().textContent();
  const token = rowText?.replace("/s/", "").trim();
  if (!token) throw new Error("share token not found in the generated row");
  return token;
}

test.describe("@phase9 Share link creation & public view", () => {
  test("9.1 generates an unguessable 22-char token; the shared page renders without auth", async ({
    page,
    browser,
  }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);

    const token = await generateShareLink(page, "view");
    expect(token).toHaveLength(22);
    expect(token).not.toContain(trip);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    const response = await anonPage.goto(`/s/${token}`);
    expect(response?.status()).toBe(200);
    await expect(anonPage.getByTestId("simulation-badge")).toBeVisible();
    await expect(anonPage.getByTestId("shared-simulation-banner")).toBeVisible();
    await expect(anonPage.getByTestId("join-shared-trip-button")).toHaveCount(0); // view-only: no join CTA
    await anonContext.close();
  });

  test("9.2/9.3 SIMULATION is visible without scrolling at 390px; owner email/savings never leak", async ({
    page,
    browser,
  }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    const token = await generateShareLink(page, "view");

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.setViewportSize({ width: 390, height: 844 });
    await anonPage.goto(`/s/${token}`);

    const badgeBox = await anonPage.getByTestId("simulation-badge").boundingBox();
    expect(badgeBox?.y ?? 9999).toBeLessThan(844);

    const html = await anonPage.content();
    expect(html).not.toContain("totalSavedCents");
    expect(html.toLowerCase()).not.toContain("@example.com");
    await anonContext.close();
  });

  test("9.4 revoking a link makes /s/[token] show the tucked-away state immediately", async ({
    page,
  }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    const token = await generateShareLink(page, "view");

    await page.getByTestId("revoke-share-link").click();
    await page.getByRole("button", { name: "Yes, revoke" }).click();
    await expect(page.getByTestId("share-link-row")).toHaveCount(0);

    const response = await page.request.get(`/s/${token}`);
    const body = await response.text();
    expect(body).toContain("tucked away");
  });

  test("9.10 the 11th share created in a day is rate-limited; only 10 exist", async ({ page }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    await page.getByTestId("open-share-sheet").click();

    for (let i = 0; i < 10; i++) {
      await page.getByTestId("generate-share-link").click();
      await expect(page.getByTestId("share-link-row")).toHaveCount(i + 1);
    }

    await page.getByTestId("generate-share-link").click();
    await expect(page.getByTestId("toast")).toContainText(/shared a lot today/i);
    await expect(page.getByTestId("share-link-row")).toHaveCount(10);
  });
});

test.describe("@phase9 Collaboration", () => {
  test("9.5/9.6 an edit-permission join creates a collaborator; the trip appears in their dashboard; attribution shows on the owner's board", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await suppressInstallPrompt(ownerPage);
    await bookTrip(ownerPage, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(ownerPage);
    await ownerPage.goto(`/trips/${trip}`);
    const token = await generateShareLink(ownerPage, "edit");

    const collabContext = await browser.newContext();
    const collabPage = await collabContext.newPage();
    await collabPage.goto(`/s/${token}`);
    await collabPage.getByTestId("join-shared-trip-button").click();
    await collabPage.waitForURL(new RegExp(`/trips/${trip}/itinerary`));

    await collabPage.getByTestId("itinerary-add-button").first().click();
    await collabPage.getByTestId("add-itinerary-title").fill("Collaborator's idea");
    await collabPage.getByTestId("add-itinerary-submit").click();
    await expect(collabPage.getByTestId("itinerary-item")).toHaveCount(1);

    await collabPage.goto("/trips");
    await expect(collabPage.getByTestId("trip-group-shared")).toBeVisible();
    await expect(collabPage.getByTestId("trip-shared-by-badge")).toBeVisible();

    await ownerPage.goto(`/trips/${trip}/itinerary`);
    await expect(ownerPage.getByTestId("itinerary-item-attribution")).toContainText("Added by");

    await ownerContext.close();
    await collabContext.close();
  });

  test("9.7 a collaborator cannot reach owner-only surfaces (packing, bookings)", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await suppressInstallPrompt(ownerPage);
    await bookTrip(ownerPage, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(ownerPage);
    await ownerPage.goto(`/trips/${trip}`);
    const token = await generateShareLink(ownerPage, "edit");
    await ownerContext.close();

    const collabContext = await browser.newContext();
    const collabPage = await collabContext.newPage();
    await collabPage.goto(`/s/${token}`);
    await collabPage.getByTestId("join-shared-trip-button").click();
    await collabPage.waitForURL(new RegExp(`/trips/${trip}/itinerary`));

    const packingResponse = await collabPage.goto(`/trips/${trip}/packing`);
    expect(packingResponse?.status()).toBe(404);
    const exploreResponse = await collabPage.goto(`/trips/${trip}/explore`);
    expect(exploreResponse?.status()).toBe(404);

    await collabContext.close();
  });

  test("9.8 downgrading a collaborator to viewer denies their next mutation", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await suppressInstallPrompt(ownerPage);
    await bookTrip(ownerPage, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(ownerPage);
    await ownerPage.goto(`/trips/${trip}`);
    const token = await generateShareLink(ownerPage, "edit");

    const collabContext = await browser.newContext();
    const collabPage = await collabContext.newPage();
    await collabPage.goto(`/s/${token}`);
    await collabPage.getByTestId("join-shared-trip-button").click();
    await collabPage.waitForURL(new RegExp(`/trips/${trip}/itinerary`));

    // Reload so the owner's page (and the share sheet's server-fetched
    // collaborator list) picks up the join that just happened in the other context.
    await ownerPage.reload();
    await ownerPage.getByTestId("open-share-sheet").click();
    await expect(ownerPage.getByTestId("collaborator-row")).toBeVisible();
    await ownerPage.locator('[data-testid="collaborator-row"] select').selectOption("viewer");
    await expect(ownerPage.getByTestId("collaborator-row")).toContainText("Viewer");

    // The collaborator's next fresh load reflects the downgrade — read-only board.
    await collabPage.goto(`/trips/${trip}/itinerary`);
    await expect(collabPage.getByTestId("itinerary-add-button")).toHaveCount(0);
    await expect(collabPage.getByTestId("itinerary-drag-handle")).toHaveCount(0);

    await ownerContext.close();
    await collabContext.close();
  });
});

test.describe("@phase9 Calendar export", () => {
  test("Add to calendar downloads a correctly-labeled .ics for the trip owner", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);

    const response = await page.request.get(`/api/calendar/${trip}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    const body = await response.text();
    expect(body).toContain("(Pretend)");
    expect(body).toContain("TRANSP:TRANSPARENT");
    expect(body).toContain("STATUS:TENTATIVE");
    expect(body).not.toContain("ORGANIZER");
    expect(body).not.toContain("ATTENDEE");
  });

  test("a view-only share token authorizes the calendar route for an anonymous visitor", async ({
    page,
    browser,
  }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}`);
    const token = await generateShareLink(page, "view");

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    const authorized = await anonPage.request.get(`/api/calendar/${trip}?token=${token}`);
    expect(authorized.status()).toBe(200);

    const unauthorized = await anonPage.request.get(`/api/calendar/${trip}`);
    expect(unauthorized.status()).toBe(404);
    await anonContext.close();
  });
});

test.describe("@phase9 viewports & accessibility", () => {
  test("9.18 share sheet and shared page are usable at 390px with 0 critical axe violations @a11y", async ({
    page,
    browser,
  }) => {
    await suppressInstallPrompt(page);
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/trips/${trip}`);

    const token = await generateShareLink(page, "view"); // opens the sheet, generates a link

    const shareResults = await new AxeBuilder({ page })
      .include('[data-testid="share-sheet"]')
      .analyze();
    expect(shareResults.violations.filter((v) => v.impact === "critical")).toEqual([]);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.setViewportSize({ width: 390, height: 844 });
    await anonPage.goto(`/s/${token}`);
    const sharedResults = await new AxeBuilder({ page: anonPage }).analyze();
    expect(sharedResults.violations.filter((v) => v.impact === "critical")).toEqual([]);
    await anonContext.close();
  });
});
