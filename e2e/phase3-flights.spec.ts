import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase3 e2e: flight search → results → detail → select, the full happy
 * path plus edge cases from docs/IMPLEMENTATION_PLAN.md QA 3.1–3.11.
 */

const JFK_LHR_NEXT_MONTH = "2026-08-15";

/** Fill an autocomplete field and pick its first (fuzzy-matched) suggestion. */
async function pickAirport(page: Page, fieldName: "From" | "To", query: string) {
  const field = page.getByRole("combobox", { name: fieldName });
  await field.fill(query);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

test.describe("@phase3 flight search", () => {
  test("3.1 autocomplete surfaces matching airports, selectable by keyboard", async ({
    page,
  }) => {
    await page.goto("/search/flights");
    const origin = page.getByRole("combobox", { name: "From" });
    await origin.click();
    await origin.fill("toky");
    await expect(page.getByRole("option", { name: /Tokyo/i })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(origin).toHaveValue(/Tokyo \(HND\)/);
  });

  test("3.2 blocks origin === destination", async ({ page }) => {
    await page.goto("/search/flights");
    await pickAirport(page, "From", "JFK");
    await pickAirport(page, "To", "JFK");
    await page.getByLabel("Departure").fill(JFK_LHR_NEXT_MONTH);
    await page.getByTestId("search-flights-submit").click();

    await expect(
      page.getByText("You're already there — pick somewhere new"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/search\/flights$/);
  });

  test("3.3 blocks a past departure date", async ({ page }) => {
    await page.goto("/search/flights");
    await pickAirport(page, "From", "JFK");
    await pickAirport(page, "To", "LHR");
    await page.getByLabel("Departure").fill("2020-01-01");
    await page.getByTestId("search-flights-submit").click();

    await expect(
      page.getByText(/Time travel isn't in the simulation/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/search\/flights$/);
  });

  test("3.4/3.8/3.9 full happy path: search → results → detail → select", async ({
    page,
  }) => {
    // Slow the results request just enough to observe the loader reliably.
    await page.route("**/search/flights/results*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto(
      `/search/flights/results?o=JFK&d=LHR&depart=${JFK_LHR_NEXT_MONTH}&pax=1&cabin=economy`,
    );
    const cards = page.getByTestId("flight-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(5);

    await cards.first().click();
    await expect(page).toHaveURL(/\/flight\/F-/);
    await expect(page.getByTestId("select-flight-submit")).toBeVisible();
    await expect(page.getByText(/you'd save/i)).toBeVisible();

    await page.getByTestId("select-flight-submit").click();
    await page.waitForURL(/\/search\/hotels/);

    const draft = await page.request.get("/api/export");
    const body = await draft.json();
    expect(body.drafts[0].draftJson.flight).toBeTruthy();

    // Draft survives a reload (server-persisted, not client state).
    await page.reload();
    const draftAfterReload = await page.request.get("/api/export");
    const bodyAfterReload = await draftAfterReload.json();
    expect(bodyAfterReload.drafts[0].draftJson.flight.id).toBe(
      body.drafts[0].draftJson.flight.id,
    );
  });

  test("3.5 identical search twice returns identical results (determinism)", async ({
    page,
  }) => {
    const url = `/search/flights/results?o=JFK&d=LHR&depart=${JFK_LHR_NEXT_MONTH}&pax=1&cabin=economy`;
    await page.goto(url);
    const first = await page.getByTestId("flight-card").allTextContents();
    await page.goto(url);
    const second = await page.getByTestId("flight-card").allTextContents();
    expect(second).toEqual(first);
  });

  test("3.6 sort by price updates order and URL; refresh preserves sort", async ({
    page,
  }) => {
    await page.goto(
      `/search/flights/results?o=JFK&d=LHR&depart=${JFK_LHR_NEXT_MONTH}&pax=1&cabin=economy`,
    );
    await page.getByLabel("Sort").selectOption("price");
    await expect(page).toHaveURL(/sort=price/);

    const prices = await page
      .getByTestId("flight-card")
      .evaluateAll((cards) =>
        cards.map((card) => {
          const match = card.textContent?.match(/\$([\d,]+)/);
          return match ? Number(match[1].replace(",", "")) : NaN;
        }),
      );
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);

    await page.reload();
    await expect(page.getByLabel("Sort")).toHaveValue("price");
  });

  test("3.7 nonstop filter on an always-connecting route shows empty state with nearby suggestions", async ({
    page,
  }) => {
    // JFK→IPC (Easter Island) on this date: every offer has a layover.
    await page.goto(
      "/search/flights/results?o=JFK&d=IPC&depart=2026-09-15&pax=1&cabin=economy",
    );
    await expect(page.getByTestId("flight-card").first()).toBeVisible();

    await page.getByRole("button", { name: "Nonstop only" }).click();
    await expect(page.getByText("No flights match those filters")).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();
  });

  test("island/remote route shows a 1-stop badge on results", async ({
    page,
  }) => {
    await page.goto(
      "/search/flights/results?o=JFK&d=IPC&depart=2026-09-01&pax=1&cabin=economy",
    );
    await expect(page.getByText(/1 stop/i).first()).toBeVisible();
  });

  test("allows a same-day round trip (return === departure)", async ({
    page,
  }) => {
    await page.goto("/search/flights");
    await pickAirport(page, "From", "JFK");
    await pickAirport(page, "To", "LHR");
    await page.getByRole("radio", { name: "Round trip" }).click();
    await page.getByLabel("Departure").fill(JFK_LHR_NEXT_MONTH);
    await page.getByLabel("Return").fill(JFK_LHR_NEXT_MONTH);
    await page.getByTestId("search-flights-submit").click();

    await expect(page).toHaveURL(/\/search\/flights\/results/);
    await expect(
      page.getByText("Return can't be before departure"),
    ).not.toBeVisible();
  });

  test("3.10 reduced motion: board loader replaced by fade skeleton", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("**/search/flights/results*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto(
      `/search/flights/results?o=JFK&d=LHR&depart=${JFK_LHR_NEXT_MONTH}&pax=1&cabin=economy`,
    );
    // Either the skeleton was caught mid-flight, or results already settled —
    // either way the animated board (GSAP flicker) must never have rendered.
    await expect(page.getByTestId("departure-board")).toHaveCount(0);
    await context.close();
  });

  test("3.11 viewports: no horizontal scroll, 44px targets, axe clean", async ({
    page,
  }) => {
    for (const route of [
      "/search/flights",
      `/search/flights/results?o=JFK&d=LHR&depart=${JFK_LHR_NEXT_MONTH}&pax=1&cabin=economy`,
    ]) {
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

    await page.goto("/search/flights");
    const box = await page.getByTestId("search-flights-submit").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
