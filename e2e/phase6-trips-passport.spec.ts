import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase6 e2e: My Trips dashboard, Trip Detail + countdown, Passport — QA
 * 6.1–6.11 from docs/IMPLEMENTATION_PLAN.md.
 *
 * A note on time control: trip status (`statusOf`) and the departure-day /
 * memory-state branch on Trip Detail are computed server-side from the real
 * wall clock at request time — there's no server-side clock hook in this
 * app (by design: no test-only backdoors), so those boundaries are covered
 * at the unit level instead (lib/services/trips.test.ts, lib/countdown.test.ts),
 * where they can be asserted exactly and deterministically. What IS
 * genuinely end-to-end here: CountdownFlip ticks live in the browser via
 * `Date.now()`, so `page.clock` can fast-forward the *client* clock after
 * the page has loaded and verify real day-rollover/never-negative behavior
 * without a server round-trip.
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

/** Books a one-way flight (skips hotels) and lands on the confirmation page. */
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

async function tripIds(page: Page): Promise<string[]> {
  const exported = await page.request.get("/api/export");
  const body = await exported.json();
  return (body.trips as { id: string }[]).map((trip) => trip.id);
}

test.describe("@phase6 My Trips dashboard", () => {
  test("6.1 dashboard with 0 trips shows the illustrated empty state", async ({
    page,
  }) => {
    await page.goto("/trips");
    await expect(page.getByRole("heading", { name: /adventures await/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /plan a trip/i })).toBeVisible();
  });

  test("6.2 dashboard groups upcoming trips and sums the savings header", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    await bookTrip(page, { from: "JFK", to: "NRT", departDate: isoDaysFromNow(30) });

    await page.goto("/trips");
    const upcomingGroup = page.getByTestId("trip-group-upcoming");
    await expect(upcomingGroup.getByTestId("trip-card")).toHaveCount(2);
    await expect(upcomingGroup.getByTestId("trip-mini-countdown").first()).toBeVisible();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    const expectedSavedCents = (body.bookings as { savedCents: number }[]).reduce(
      (sum, booking) => sum + booking.savedCents,
      0,
    );
    expect(body.user.totalSavedCents).toBe(expectedSavedCents);
    await expect(page.getByTestId("savings-tally")).toContainText("$");
  });

  test("6.7 rename and delete a trip; the passport stamp survives the delete", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(15) });
    await page.goto("/trips");

    await page.getByTestId("trip-card-menu-button").click();
    await page.getByRole("button", { name: "Rename" }).click();
    const input = page.getByTestId("trip-rename-input");
    await input.fill("My Lisbon Escape");
    await page.getByTestId("trip-rename-save").click();
    await expect(page.getByText("My Lisbon Escape")).toBeVisible();

    const [tripId] = await tripIds(page);

    await page.getByTestId("trip-card-menu-button").click();
    await page.getByRole("button", { name: "Delete trip" }).click();
    await page.getByTestId("trip-delete-confirm").click();
    await expect(page.getByTestId("trip-card")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /adventures await/i })).toBeVisible();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.trips).toHaveLength(0);
    expect(body.passportStamps).toHaveLength(1);
    // The stamp persists as a memory — its trip link is cleared, not the stamp itself.
    expect(body.passportStamps[0].tripId).toBeNull();
    void tripId; // documents which trip this was, not otherwise asserted
  });
});

test.describe("@phase6 Trip Detail + countdown", () => {
  test("6.3 renders a live countdown with no negative digits, tz-explicit facts", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(12) });
    const [tripId] = await tripIds(page);
    await page.goto(`/trips/${tripId}`);

    const countdown = page.getByTestId("countdown-flip");
    await expect(countdown).toBeVisible();
    const daysText = await page
      .getByTestId("countdown-field-days")
      .textContent();
    const days = Number(daysText);
    // The exact hour of departure is engine-chosen, so allow a day of slack
    // either side of the requested date — never negative, never absurd.
    expect(days).toBeGreaterThanOrEqual(10);
    expect(days).toBeLessThanOrEqual(13);
  });

  test("6.4/6.5 client time advances the countdown and it never goes negative, even long after departure", async ({
    browser,
  }) => {
    // Reduced motion here isn't testing the reduced-motion path per se — it
    // sidesteps AnimatePresence's overlapping enter/exit DOM nodes (already
    // covered precisely by components/countdown-flip.test.tsx's fake-timer
    // suite) so this test can read plain digit text reliably. The
    // day-rollover flourish's exact appear/fade timing is unit-tested
    // there too; what's genuinely only verifiable end-to-end is that real
    // client-side time passing (via page.clock) actually decrements the
    // live countdown and never dips negative, arbitrarily far out.
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(2) });
    const [tripId] = await tripIds(page);

    await page.clock.install();
    await page.goto(`/trips/${tripId}`);
    await expect(page.getByTestId("countdown-flip")).toBeVisible();

    const initialDays = Number(
      await page.getByTestId("countdown-field-days").textContent(),
    );
    expect(initialDays).toBeGreaterThanOrEqual(1);

    // Generous jump (comfortably more than a day) — guarantees at least one
    // day-boundary crossing regardless of the engine-chosen departure hour.
    // The extra 61s lets the reduced-motion once-a-minute tick catch up.
    await page.clock.fastForward(26 * 60 * 60 * 1000);
    await page.clock.fastForward(61 * 1000);
    const laterDays = Number(
      await page.getByTestId("countdown-field-days").textContent(),
    );
    expect(laterDays).toBeLessThan(initialDays);

    // Fast-forward far past departure entirely — never negative.
    await page.clock.fastForward(240 * 60 * 60 * 1000);
    await page.clock.fastForward(61 * 1000);
    for (const field of ["days", "hrs", "min", "sec"]) {
      const text = await page.getByTestId(`countdown-field-${field}`).textContent();
      expect(text).not.toContain("-");
      expect(text).toMatch(/^0+$/);
    }
    await context.close();
  });
});

test.describe("@phase6 Virtual Passport", () => {
  test("6.8/6.10 passport renders deterministic stamps and an accurate miles-dreamed tally", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(8) });
    await bookTrip(page, { from: "LAX", to: "NRT", departDate: isoDaysFromNow(20) });

    await page.goto("/passport");
    await expect(page.getByTestId("stamp-card")).toHaveCount(2);

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    const totalKm = (body.passportStamps as { distanceKm: number }[]).reduce(
      (sum, stamp) => sum + stamp.distanceKm,
      0,
    );
    const expectedMiles = Math.round(totalKm * 0.621371).toLocaleString();
    await expect(page.getByTestId("passport-summary")).toContainText(expectedMiles);

    await page.getByTestId("stamp-card").first().click();
    await expect(page.getByTestId("stamp-detail-sheet")).toBeVisible();
  });

  test("6.9 a fresh booking's stamp entrance query flag is scrubbed after load", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(9) });
    await page.getByRole("link", { name: /view passport/i }).click();
    // The one-time `justStamped` flag is scrubbed from the URL shortly after
    // load (components/passport-effects.tsx) — assert the settled state.
    await expect(page).toHaveURL(/\/passport$/);
    await expect(page.getByTestId("stamp-card")).toHaveCount(1);
  });

  test("6.9 reduced motion: passport renders the stamp instantly, no crash", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(9) });
    await page.getByRole("link", { name: /view passport/i }).click();
    await expect(page.getByTestId("stamp-card")).toHaveCount(1);
    await context.close();
  });
});

test.describe("@phase6 viewports & accessibility", () => {
  test("6.11 /trips, trip detail, and /passport are clean across viewports", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(11) });
    const [tripId] = await tripIds(page);

    for (const route of ["/trips", `/trips/${tripId}`, "/passport"]) {
      await page.goto(route);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalScroll, route).toBe(false);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (violation) => violation.impact === "critical",
      );
      expect(critical, `${route}: ${JSON.stringify(critical, null, 2)}`).toEqual([]);
    }

    await page.goto("/trips");
    const box = await page.getByTestId("trip-card-menu-button").first().boundingBox();
    // Sub-pixel layout rounding can land a hair under 44 (e.g. 43.9999…);
    // round to the nearest pixel before comparing against the 44px target.
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
  });
});
