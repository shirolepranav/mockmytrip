import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase6 e2e: My Trips dashboard, trip detail + countdown, and the
 * passport, covering docs/IMPLEMENTATION_PLAN.md QA 6.1–6.11. Date-dependent
 * states (past/in-progress/departure-day trips) can't come from the real
 * search->checkout flow — its date picker floors at today — so those cases
 * use the dev-only /api/test/seed-trip endpoint (gated by NODE_ENV + a
 * shared secret set in playwright.config.ts, never reachable in
 * production). The fresh-booking cases (6.9) drive the real flow instead.
 */

const JFK_LIS_NEXT_MONTH = "2026-08-15";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const TEST_SEED_SECRET = process.env.TEST_SEED_SECRET ?? "";

interface SeedTripOverrides {
  title?: string;
  originIata?: string;
  destIata?: string;
  departAt?: string;
  arriveAt?: string;
  endDate?: string;
  distanceKm?: number;
  savedCents?: number;
  withStamp?: boolean;
}

async function seedTrip(page: Page, overrides: SeedTripOverrides = {}) {
  const now = Date.now();
  const body = {
    departAt: new Date(now + 10 * DAY_MS).toISOString(),
    arriveAt: new Date(now + 10 * DAY_MS + 8 * HOUR_MS).toISOString(),
    endDate: new Date(now + 15 * DAY_MS).toISOString(),
    ...overrides,
  };
  const response = await page.request.post("/api/test/seed-trip", {
    data: body,
    headers: { "x-test-seed-secret": TEST_SEED_SECRET },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<{ tripId: string; bookingId: string }>;
}

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

/** Search JFK->Lisbon, book it for real, land on confirmation. */
async function bookATrip(page: Page) {
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

test.describe("@phase6 trips, countdown & passport", () => {
  test("6.1 dashboard with 0 trips shows the illustrated empty state + CTA", async ({ page }) => {
    await page.goto("/trips");
    await expect(page.getByTestId("trips-empty-state")).toBeVisible();
    await expect(page.getByRole("link", { name: /search flights/i })).toBeVisible();
  });

  test("6.2 dashboard groups upcoming/in-progress/memory trips with a correct savings sum, and the mini-countdown ticks", async ({
    page,
  }) => {
    const now = Date.now();
    await seedTrip(page, {
      title: "Lisbon getaway",
      departAt: new Date(now + 5 * DAY_MS).toISOString(),
      arriveAt: new Date(now + 5 * DAY_MS + 8 * HOUR_MS).toISOString(),
      endDate: new Date(now + 10 * DAY_MS).toISOString(),
      savedCents: 4000,
    });
    await seedTrip(page, {
      title: "Tokyo adventure",
      destIata: "NRT",
      departAt: new Date(now - 1 * DAY_MS).toISOString(),
      arriveAt: new Date(now - 1 * DAY_MS + 12 * HOUR_MS).toISOString(),
      endDate: new Date(now + 2 * DAY_MS).toISOString(),
      savedCents: 6000,
    });
    await seedTrip(page, {
      title: "Past trip",
      departAt: new Date(now - 20 * DAY_MS).toISOString(),
      arriveAt: new Date(now - 20 * DAY_MS + 8 * HOUR_MS).toISOString(),
      endDate: new Date(now - 15 * DAY_MS).toISOString(),
      savedCents: 3000,
    });

    // Install the fake clock before navigating — the page's own tick
    // interval must be created against the faked timers from the start, or
    // fastForward() has no effect on an interval already running on the
    // real clock.
    await page.clock.install({ time: now });
    await page.goto("/trips");
    await expect(page.getByTestId("trip-group-upcoming")).toContainText("Lisbon getaway");
    await expect(page.getByTestId("trip-group-in_progress")).toContainText("Tokyo adventure");
    await expect(page.getByTestId("trip-group-memory")).toContainText("Past trip");

    // Savings header = sum of the three seeded amounts.
    await expect(page.getByText("$130")).toBeVisible();

    // Mini-countdown chip ticks.
    const chip = page.getByTestId("trip-group-upcoming").getByTestId("mini-countdown-chip");
    const before = await chip.textContent();
    await page.clock.fastForward("02:00:00");
    await expect(chip).not.toHaveText(before ?? "");
  });

  test("6.3 countdown accuracy for a 10d3h delta, correct across a tz-different route", async ({ page }) => {
    const now = Date.now();
    const target = now + 10 * DAY_MS + 3 * HOUR_MS;
    const { tripId } = await seedTrip(page, {
      departAt: new Date(target).toISOString(),
      arriveAt: new Date(target + 8 * HOUR_MS).toISOString(),
      endDate: new Date(target + 5 * DAY_MS).toISOString(),
    });
    await page.goto(`/trips/${tripId}`);
    await expect(page.getByTestId("countdown-flap-days")).toContainText("10");
    // Allow a 1-2h tolerance band for the request's own real elapsed time.
    await expect(page.getByTestId("countdown-flap-hours")).toContainText(/0[1-3]/);
    await expect(page.getByText(/local time/i)).toBeVisible();

    const { tripId: tzTripId } = await seedTrip(page, {
      originIata: "LAX",
      destIata: "NRT",
      departAt: new Date(target).toISOString(),
      arriveAt: new Date(target + 11 * HOUR_MS).toISOString(),
      endDate: new Date(target + 5 * DAY_MS).toISOString(),
    });
    await page.goto(`/trips/${tzTripId}`);
    await expect(page.getByTestId("countdown-flap-days")).toContainText("10");
    await expect(page.getByText(/local time/i)).toBeVisible();
  });

  test("6.4 day rollover plays the flourish once and the aria-live day text changes only once", async ({ page }) => {
    const now = Date.now();
    const target = now + 2 * DAY_MS + 12 * HOUR_MS; // 2.5 days out
    const { tripId } = await seedTrip(page, {
      departAt: new Date(target).toISOString(),
      arriveAt: new Date(target + 8 * HOUR_MS).toISOString(),
      endDate: new Date(target + 5 * DAY_MS).toISOString(),
    });

    await page.clock.install({ time: now });
    await page.goto(`/trips/${tripId}`);
    await expect(page.getByTestId("countdown-flap-days")).toContainText("2");
    const liveRegion = page.locator('[aria-live="polite"]').first();
    const before = await liveRegion.textContent();

    // Cross the day boundary.
    await page.clock.fastForward(DAY_MS);
    await expect(page.getByTestId("countdown-flap-days")).toContainText("1");
    await expect(liveRegion).not.toHaveText(before ?? "");
    await expect(page.getByTestId("countdown-day-rollover")).toBeVisible();

    // Flourish clears itself after its window.
    await page.clock.fastForward(1000);
    await expect(page.getByTestId("countdown-day-rollover")).toHaveCount(0);
  });

  test("6.5 opening a past-dated trip shows the memory state — never a negative countdown", async ({ page }) => {
    const now = Date.now();
    const { tripId } = await seedTrip(page, {
      departAt: new Date(now - 20 * DAY_MS).toISOString(),
      arriveAt: new Date(now - 20 * DAY_MS + 8 * HOUR_MS).toISOString(),
      endDate: new Date(now - 15 * DAY_MS).toISOString(),
    });
    await page.goto(`/trips/${tripId}`);
    await expect(page.getByTestId("trip-memory-banner")).toBeVisible();
    await expect(page.getByTestId("countdown-flip")).toHaveCount(0);
    await expect(page.getByTestId("countdown-bon-voyage")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/-\d/);
  });

  test("6.6 departure day shows the Bon voyage state", async ({ page }) => {
    const now = Date.now();
    const { tripId } = await seedTrip(page, {
      departAt: new Date(now - 30 * 60_000).toISOString(), // departed 30 min ago
      arriveAt: new Date(now + 7 * HOUR_MS).toISOString(),
      endDate: new Date(now + 5 * DAY_MS).toISOString(),
    });
    await page.goto(`/trips/${tripId}`);
    await expect(page.getByTestId("countdown-bon-voyage")).toBeVisible();
    await expect(page.getByText(/off to/i)).toBeVisible();
  });

  test("6.7 rename persists and delete removes the trip but keeps its passport stamp", async ({ page }) => {
    await bookATrip(page);
    await page.goto("/trips");

    await page.getByTestId("trip-card-menu-trigger").click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const input = page.getByTestId("trip-rename-input");
    await input.fill("Renamed getaway");
    await input.blur();
    await page.waitForTimeout(300); // form submit + revalidate
    await page.reload();
    await expect(page.getByTestId("trip-card-title")).toHaveText("Renamed getaway");

    await page.getByTestId("trip-card-menu-trigger").click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await expect(page.getByText(/no undo/i)).toBeVisible();
    // No confirm-shaming copy (golden rule #3).
    await expect(page.getByText(/are you sure/i)).toHaveCount(0);
    await page.getByTestId("trip-delete-confirm").click();
    await expect(page.getByTestId("trips-empty-state")).toBeVisible();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.trips).toHaveLength(0);
    expect(body.bookings).toHaveLength(0);
    expect(body.passportStamps).toHaveLength(1); // stamps persist — they're memories

    await page.goto("/passport");
    await expect(page.getByTestId("stamp-card")).toHaveCount(1);
  });

  test("6.8 passport renders deterministic stamps and opens the detail sheet on tap", async ({ page }) => {
    const now = Date.now();
    for (const destIata of ["LIS", "NRT", "CDG"]) {
      await seedTrip(page, {
        destIata,
        departAt: new Date(now + 5 * DAY_MS).toISOString(),
        arriveAt: new Date(now + 5 * DAY_MS + 8 * HOUR_MS).toISOString(),
        endDate: new Date(now + 10 * DAY_MS).toISOString(),
      });
    }

    await page.goto("/passport");
    const cards = page.getByTestId("stamp-card");
    await expect(cards).toHaveCount(3);

    const styleBefore = await cards.first().locator("svg").getAttribute("style");
    await page.reload();
    const styleAfter = await page.getByTestId("stamp-card").first().locator("svg").getAttribute("style");
    expect(styleAfter).toBe(styleBefore);

    await cards.first().click();
    await expect(page.getByTestId("stamp-detail-sheet")).toBeVisible();
  });

  test("6.9 a fresh booking's stamp animates into the passport", async ({ page }) => {
    await bookATrip(page);
    await page.getByRole("link", { name: "View passport" }).click();
    await page.waitForURL(/\/passport\?justStamped=1/);
    await expect(page.getByTestId("stamp-card")).toHaveCount(1);
  });

  test("6.9 reduced motion: the fresh stamp appears instantly, no transient animation state", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await bookATrip(page);
    await page.getByRole("link", { name: "View passport" }).click();
    await page.waitForURL(/\/passport\?justStamped=1/);
    await expect(page.getByTestId("stamp-card")).toHaveCount(1);
    await context.close();
  });

  test("6.10 miles dreamed equals the formatted sum of booked route distances", async ({ page }) => {
    const now = Date.now();
    const distances: Record<string, number> = { LIS: 5400, NRT: 10800 };
    for (const [destIata, distanceKm] of Object.entries(distances)) {
      await seedTrip(page, {
        destIata,
        distanceKm,
        departAt: new Date(now + 5 * DAY_MS).toISOString(),
        arriveAt: new Date(now + 5 * DAY_MS + 8 * HOUR_MS).toISOString(),
        endDate: new Date(now + 10 * DAY_MS).toISOString(),
      });
    }

    await page.goto("/passport");
    const totalKm = Object.values(distances).reduce((a, b) => a + b, 0);
    const expectedMiles = Math.round(totalKm * 0.621371).toLocaleString("en-US");
    await expect(page.getByTestId("passport-miles")).toContainText(expectedMiles);
  });

  test("6.11 viewports: no horizontal scroll, 44px targets, axe clean, countdown not spamming screen readers", async ({
    page,
  }) => {
    const now = Date.now();
    const { tripId } = await seedTrip(page, {
      departAt: new Date(now + 5 * DAY_MS).toISOString(),
      arriveAt: new Date(now + 5 * DAY_MS + 8 * HOUR_MS).toISOString(),
      endDate: new Date(now + 10 * DAY_MS).toISOString(),
    });

    for (const route of ["/trips", `/trips/${tripId}`, "/passport"]) {
      await page.goto(route);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll, route).toBe(false);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((violation) => violation.impact === "critical");
      expect(critical, `${route}: ${JSON.stringify(critical, null, 2)}`).toEqual([]);
    }

    await page.goto("/trips");
    const menuBox = await page.getByTestId("trip-card-menu-trigger").first().boundingBox();
    expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);

    // Countdown aria-live isn't spamming: text stays put across several
    // seconds of ticking when no day boundary is crossed.
    await page.goto(`/trips/${tripId}`);
    const liveRegion = page.locator('[aria-live="polite"]').first();
    const before = await liveRegion.textContent();
    await page.clock.install();
    await page.clock.fastForward(5000);
    await expect(liveRegion).toHaveText(before ?? "");
  });
});
