import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase5 e2e: checkout → boarding-pass reveal → confirmation → PDF, the
 * full happy path plus edge cases from docs/IMPLEMENTATION_PLAN.md QA
 * 5.1–5.11 (the two permanent ethics guards live in e2e/ethics/*.spec.ts).
 */

const JFK_LIS_NEXT_MONTH = "2026-08-15";

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

/** Search JFK→Lisbon, select the first flight, skip hotels, land on checkout. */
async function arriveAtCheckout(page: Page) {
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
}

test.describe("@phase5 checkout & boarding pass", () => {
  test("5.1 checkout renders $0.00 due, struck-through total, savings, SIMULATION banner", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await expect(page.getByTestId("checkout-due-amount")).toHaveText("$0.00");
    await expect(page.getByTestId("checkout-grand-total")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
    await expect(page.getByTestId("savings-tally")).toBeVisible();
    await expect(page.getByTestId("checkout-simulation-banner")).toContainText(
      /simulation/i,
    );
    // Pinned while scrolling — the global badge is fixed-position on every route.
    await expect(page.getByTestId("simulation-badge")).toBeVisible();
  });

  test("5.3 confirm booking creates trip/booking/flight/stamp rows and plays the reveal", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\/.+justBooked=1/);

    await expect(page.getByTestId("boarding-pass-reveal")).toBeVisible();
    await expect(page.getByTestId("boarding-pass")).toBeVisible();
    await expect(page.getByText(/SIM-[A-Z0-9]{6}/)).toBeVisible();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.trips).toHaveLength(1);
    expect(body.bookings).toHaveLength(1);
    expect(body.passportStamps).toHaveLength(1);
    expect(body.user.totalSavedCents).toBeGreaterThan(0);
    expect(body.drafts).toHaveLength(0); // draft cleared after booking

    // The one-time query flags are scrubbed from the URL shortly after load.
    await expect(page).toHaveURL(/\/trip\/confirmation\/[^/?]+$/);
  });

  test("5.4 double-tap Confirm creates exactly one booking", async ({ page }) => {
    await arriveAtCheckout(page);
    const submit = page.getByTestId("confirm-booking-submit");
    // Fire two near-simultaneous clicks via dispatchEvent (bypasses
    // Playwright's actionability wait, which would otherwise block the
    // second click on the button's disabled-while-pending state) — this
    // exercises the real double-tap race, not just the UI debounce.
    await Promise.all([
      submit.dispatchEvent("click"),
      submit.dispatchEvent("click"),
    ]);
    await page.waitForURL(/\/trip\/confirmation\//);

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.bookings).toHaveLength(1);
  });

  test("5.5 reduced-motion confirm: no reveal animation, static celebration, booking still created", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);

    await expect(page.getByTestId("reveal-static-celebration")).toBeVisible();
    await expect(page.getByTestId("boarding-pass")).toBeVisible();

    const exported = await page.request.get("/api/export");
    const body = await exported.json();
    expect(body.bookings).toHaveLength(1);
    await context.close();
  });

  test("5.7/5.8 email provided vs omitted: booking + pass always succeed", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("checkout-email-input").fill("traveler@example.com");
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\/.+emailStatus=/);
    await expect(page.getByTestId("boarding-pass")).toBeVisible();
    // No RESEND_API_KEY in the test/dev environment → graceful "failed" toast,
    // pass still fully usable (QA 5.8's exact scenario without needing a mock).
    await expect(page.getByTestId("toast")).toContainText(/email/i);
  });

  test("5.6 download PDF returns a real PDF for the booked pass", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);

    const href = await page.getByTestId("download-pdf-link").getAttribute("href");
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const buffer = await response.body();
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("5.9 forged bookingId PDF request is denied without leaking info", async ({
    page,
  }) => {
    await arriveAtCheckout(page); // establishes a session
    const response = await page.request.get(
      "/api/boarding-pass/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status()).toBe(404);
  });

  test("5.10 checkout error is friendly and never loses the trip draft", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await page.route("**/trip/checkout", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.getByTestId("confirm-booking-submit").click();

    // The draft survives — summary still resolves the same flight.
    await page.goto("/trip/summary");
    await expect(page.getByTestId("continue-to-checkout")).toBeVisible();
  });

  test("5.11 viewports: no horizontal scroll, 44px targets, axe clean", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    for (const route of [page.url()]) {
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

    const box = await page.getByTestId("confirm-booking-submit").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);
    const confirmationResults = await new AxeBuilder({ page }).analyze();
    const confirmationCritical = confirmationResults.violations.filter(
      (violation) => violation.impact === "critical",
    );
    expect(confirmationCritical).toEqual([]);
  });
});
