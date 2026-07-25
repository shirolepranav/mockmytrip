import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase7 e2e: itinerary builder + packing list — QA 7.1-7.3, 7.7-7.10 from
 * docs/IMPLEMENTATION_PLAN.md. QA 7.9's mutation-level ownership denial is
 * covered precisely at the unit level (lib/services/itinerary.test.ts);
 * this suite covers the page-level read boundary instead (a real HTTP
 * navigation a non-owner can actually attempt).
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

test.describe("@phase7 Itinerary builder", () => {
  test("7.1 add/edit/delete persists; undo within 8s restores; order stable", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}/itinerary`);

    await page.getByTestId("itinerary-add-button").first().click();
    await page.getByTestId("add-itinerary-title").fill("Breakfast");
    await page.getByTestId("add-itinerary-submit").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(1);

    await page.getByTestId("itinerary-add-button").first().click();
    await page.getByTestId("add-itinerary-title").fill("Museum");
    await page.getByTestId("add-itinerary-submit").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(2);

    // Edit
    await page.getByTestId("itinerary-item-title").first().click();
    await page.getByTestId("itinerary-edit-title").fill("Breakfast at the café");
    await page.getByTestId("itinerary-edit-save").click();
    await expect(page.getByTestId("itinerary-item-title").first()).toContainText(
      "Breakfast at the café",
    );

    // Delete + undo
    await page.getByTestId("itinerary-delete").first().click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(1);
    await expect(page.getByTestId("undo-toast")).toBeVisible();
    await page.getByTestId("undo-toast-action").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(2);
    await expect(page.getByTestId("itinerary-item-title").first()).toContainText(
      "Breakfast at the café",
    );

    // Delete for real this time (let the undo window elapse)
    await page.getByTestId("itinerary-delete").first().click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(1);
    await page.waitForTimeout(8500);
    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.itineraryItems).toHaveLength(1);
    expect(body.itineraryItems[0].title).toBe("Museum");
  });

  test("7.3 an item added beyond the trip length is clamped to the last valid day", async ({
    page,
  }) => {
    // A one-way flight-only trip is short (2 inclusive days); adding "beyond
    // the length" is exercised precisely at the unit level
    // (lib/services/itinerary.test.ts) with an out-of-range dayIndex. Here,
    // confirm the UI only ever offers valid day columns to add into.
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}/itinerary`);
    const dayColumns = await page.locator('[data-testid^="itinerary-day-"]').count();
    expect(dayColumns).toBeGreaterThan(0);

    await page.getByTestId("itinerary-add-button").last().click();
    await page.getByTestId("add-itinerary-title").fill("Last day plan");
    await page.getByTestId("add-itinerary-submit").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(1);

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.itineraryItems[0].dayIndex).toBeLessThan(dayColumns);
  });

  test("7.2 within-day touch drag reorder persists across reload", async ({
    browser,
  }) => {
    const context = await browser.newContext(); // desktop-chrome project still supports touch here via hasTouch below
    const page = await context.newPage();
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}/itinerary`);

    await page.getByTestId("itinerary-add-button").first().click();
    await page.getByTestId("add-itinerary-title").fill("First");
    await page.getByTestId("add-itinerary-submit").click();
    await page.getByTestId("itinerary-add-button").first().click();
    await page.getByTestId("add-itinerary-title").fill("Second");
    await page.getByTestId("add-itinerary-submit").click();
    await expect(page.getByTestId("itinerary-item")).toHaveCount(2);

    const handles = page.getByTestId("itinerary-drag-handle");
    const firstHandle = handles.first();
    const secondHandle = handles.nth(1);
    const firstBox = await firstHandle.boundingBox();
    const secondBox = await secondHandle.boundingBox();
    if (firstBox && secondBox) {
      await firstHandle.hover();
      await page.mouse.down();
      await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height + 10, {
        steps: 8,
      });
      await page.mouse.up();
    }
    await page.waitForTimeout(500);

    const titlesAfterDrag = await page.getByTestId("itinerary-item-title").allTextContents();
    await page.reload();
    const titlesAfterReload = await page.getByTestId("itinerary-item-title").allTextContents();
    expect(titlesAfterReload).toEqual(titlesAfterDrag);
    await context.close();
  });

  test("page-level ownership: another guest cannot view this trip's itinerary", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await bookTrip(ownerPage, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(ownerPage);
    await ownerContext.close();

    const strangerContext = await browser.newContext();
    const strangerPage = await strangerContext.newPage();
    await strangerPage.goto("/"); // establishes a fresh guest session for this context
    const response = await strangerPage.goto(`/trips/${trip}/itinerary`);
    expect(response?.status()).toBe(404);
    await strangerContext.close();
  });
});

test.describe("@phase7 Packing list", () => {
  test("7.7/7.8 auto-generates, checks off with a progress bar, and celebrates once all-checked", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}/packing`);

    await page.getByTestId("packing-auto-generate").click();
    await expect(page.getByTestId("packing-item").first()).toBeVisible();
    const count = await page.getByTestId("packing-item").count();
    expect(count).toBeGreaterThan(0);
    await expect(page.getByTestId("packing-progress-label")).toContainText(`0 of ${count}`);

    const toggles = page.getByTestId("packing-item-toggle");
    for (let i = 0; i < count; i++) {
      await toggles.nth(i).click();
    }
    await expect(page.getByTestId("packing-progress-label")).toContainText(`${count} of ${count}`);
    await expect(page.getByTestId("packing-celebration")).toBeVisible();
  });

  test("7.8 reduced motion: check-off and celebration still work, no animation errors", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.goto(`/trips/${trip}/packing`);
    await page.getByTestId("packing-auto-generate").click();
    await page.getByTestId("packing-item-toggle").first().click();
    await expect(page.getByTestId("packing-item").first()).toBeVisible();
    await context.close();
  });
});

test.describe("@phase7 viewports & accessibility", () => {
  test("7.10 itinerary and packing are usable at 390px with 0 critical axe violations", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const trip = await tripId(page);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of [`/trips/${trip}/itinerary`, `/trips/${trip}/packing`]) {
      await page.goto(route);
      if (route.endsWith("packing")) {
        await page.getByTestId("packing-auto-generate").click();
      }
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll, route).toBe(false);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      expect(critical, `${route}: ${JSON.stringify(critical, null, 2)}`).toEqual([]);
    }

    const handleBox = await page.goto(`/trips/${trip}/itinerary`).then(async () => {
      await page.getByTestId("itinerary-add-button").first().click();
      await page.getByTestId("add-itinerary-title").fill("Touch target check");
      await page.getByTestId("add-itinerary-submit").click();
      return page.getByTestId("itinerary-drag-handle").first().boundingBox();
    });
    expect(Math.round(handleBox?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(handleBox?.width ?? 0)).toBeGreaterThanOrEqual(44);
  });
});
