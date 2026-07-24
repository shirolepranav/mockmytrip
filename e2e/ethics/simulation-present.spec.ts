import { expect, test, type Page } from "@playwright/test";
import { PDFParse } from "pdf-parse";

/*
 * Permanent ethics guard (IMPLEMENTATION_PLAN Phase 5 task 8, golden rule
 * #2): SIMULATION must be visible on checkout, the on-screen pass, and the
 * PDF's text layer. Required CI check on every commit from Phase 5 onward
 * — also tagged @phase5 so it's part of this phase's own regression run.
 * The email-HTML half of this guard lives in
 * lib/email/booking-confirmation.test.ts (Vitest) rather than here, since
 * asserting on a rendered React Email template is a unit-level concern —
 * it still runs on every commit via `npm run test`, so the CI guarantee
 * holds either way.
 */

const JFK_LIS_NEXT_MONTH = "2026-08-15";

async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

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

test.describe("@phase5 @ethics SIMULATION always present", () => {
  test("checkout shows a SIMULATION label", async ({ page }) => {
    await arriveAtCheckout(page);
    await expect(page.getByTestId("checkout-simulation-banner")).toContainText(
      /simulation/i,
    );
    await expect(page.getByTestId("simulation-badge")).toBeVisible();
  });

  test("on-screen boarding pass shows a SIMULATION label", async ({ page }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);
    const pass = page.getByTestId("boarding-pass");
    await expect(pass.getByText(/simulation/i).first()).toBeVisible();
  });

  test("downloaded PDF has SIMULATION in its text layer", async ({ page }) => {
    await arriveAtCheckout(page);
    await page.getByTestId("confirm-booking-submit").click();
    await page.waitForURL(/\/trip\/confirmation\//);

    const href = await page.getByTestId("download-pdf-link").getAttribute("href");
    const response = await page.request.get(href!);
    const buffer = await response.body();

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    expect(result.text).toContain("SIMULATION");
  });
});
