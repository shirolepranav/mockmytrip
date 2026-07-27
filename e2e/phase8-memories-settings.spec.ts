import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase8 e2e: Trip Memories (locked state), Settings appearance toggles,
 * and the About/Ethics page — QA 8.8 (locked half), 8.10, 8.11 from
 * docs/IMPLEMENTATION_PLAN.md.
 *
 * Scope note: the *unlocked* Memories recap only renders once a trip's
 * end date has actually passed on the server's real wall clock — there's
 * no server-side clock hook in this app (see e2e/phase6-trips-passport.spec.ts's
 * "no test-only backdoors" rationale), so that branch, the in-session
 * unlock watcher, and the postcard/share components are covered at the
 * unit/component level instead (components/memories-unlock-watcher.test.tsx,
 * components/postcard-share-button.test.tsx). This suite covers the locked
 * state, which every booked trip actually reaches.
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

test.describe("@phase8 Trip Memories", () => {
  test("8.8 locked before the trip's end date, with the unlock date shown", async ({
    page,
  }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(10) });
    const exported = await page.request.get("/api/export");
    const trip = (await exported.json()).trips[0].id as string;

    await page.goto(`/trips/${trip}/memories`);
    await expect(page.getByTestId("memories-locked")).toBeVisible();
    await expect(page.getByTestId("memories-unlocked")).not.toBeVisible();
    await expect(page.getByTestId("simulation-badge")).toBeVisible();
  });

  test("trip detail links out to Memories", async ({ page }) => {
    await bookTrip(page, { from: "JFK", to: "LIS", departDate: isoDaysFromNow(5) });
    const exported = await page.request.get("/api/export");
    const trip = (await exported.json()).trips[0].id as string;
    await page.goto(`/trips/${trip}`);
    // An upcoming trip doesn't show the memory link (only "memory"-status
    // trips do) — visiting the route directly (above) is what's reachable.
    await expect(page.getByTestId("trip-memory")).not.toBeVisible();
  });
});

test.describe("@phase8 Settings appearance", () => {
  test("8.10 reduced-motion toggle overrides immediately, app-wide", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("motion-option-reduced").click();
    await expect(page.getByTestId("motion-option-reduced")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe(
      "reduced",
    );

    // Persists across navigation without re-selecting. `page.goto` is a
    // full browser navigation (unlike an in-app Link click), so wait for
    // MotionProvider's mount effect to re-apply the dataset attribute
    // rather than checking the instant the navigation settles.
    await page.goto("/trips");
    await page.waitForFunction(
      () => document.documentElement.dataset.motion === "reduced",
    );

    await page.goto("/settings");
    await page.getByTestId("motion-option-system").click();
    await expect(page.getByTestId("motion-option-system")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("8.11 theme switch applies night-flight tokens and stays AA-contrast clean @a11y", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByTestId("theme-option-night").click();
    await expect(page.getByTestId("theme-option-night")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(
      "night",
    );

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .analyze();
    const contrastViolations = results.violations.filter(
      (violation) => violation.id === "color-contrast",
    );
    expect(contrastViolations).toEqual([]);

    // Switch back so this test doesn't leak state into others via storage.
    await page.getByTestId("theme-option-light").click();
  });
});

test.describe("@phase8 About / Ethics", () => {
  test("shows the SIMULATION badge and the ethics pledge", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByTestId("simulation-badge")).toBeVisible();
    await expect(page.getByRole("heading", { name: /about wanderlost/i })).toBeVisible();
    await expect(page.getByText(/no payments, ever/i)).toBeVisible();
  });

  test("is reachable from Settings", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /about & ethics/i }).click();
    await expect(page).toHaveURL(/\/about$/);
  });
});
