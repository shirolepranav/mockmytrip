import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
 * @phase0 regression: app shell, fonts, SIMULATION badge, reduced motion.
 * QA cases 0.1–0.5 from docs/IMPLEMENTATION_PLAN.md.
 */

test.describe("@phase0 shell", () => {
  test("token gallery renders with the brand fonts, not Inter/system", async ({
    page,
  }) => {
    await page.goto("/dev/components");
    await expect(page.getByTestId("gallery-title")).toBeVisible();

    const displayFont = await page
      .getByTestId("font-display-sample")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(displayFont).toMatch(/Clash|Bricolage/i);
    expect(displayFont).not.toMatch(/Inter|Roboto|Arial/i);

    const monoFont = await page
      .getByTestId("font-mono-sample")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(monoFont).toMatch(/Martian|Space Mono/i);

    const bodyFont = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(bodyFont).toMatch(/Hanken/i);
  });

  test("SIMULATION badge is present on app routes and opens the explainer", async ({
    page,
  }) => {
    for (const route of ["/search/flights", "/trips", "/passport", "/settings"]) {
      await page.goto(route);
      await expect(page.getByTestId("simulation-badge")).toBeVisible();
    }
    await page.getByTestId("simulation-badge").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /beautiful lie/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /close explainer/i }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("shell nav adapts: bottom tabs on mobile, top nav on desktop", async ({
    page,
  }, testInfo) => {
    await page.goto("/trips");
    const isDesktop = testInfo.project.name === "desktop-chrome";
    if (isDesktop) {
      await expect(page.getByTestId("top-nav")).toBeVisible();
      await expect(page.getByTestId("bottom-tab-bar")).toBeHidden();
    } else {
      await expect(page.getByTestId("bottom-tab-bar")).toBeVisible();
      // Tab targets must be ≥ 44px tall.
      const box = await page
        .getByTestId("bottom-tab-bar")
        .getByRole("link", { name: "Trips" })
        .boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("reduced motion: page transition is instant", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/trips");
    // The template wrapper should land at full opacity with no transform delay.
    const opacity = await page
      .locator("main")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
    await context.close();
  });

  test("axe: no critical violations on shell routes", async ({ page }) => {
    for (const route of ["/", "/trips", "/dev/components"]) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (violation) => violation.impact === "critical",
      );
      expect(critical, `${route}: ${JSON.stringify(critical, null, 2)}`).toEqual(
        [],
      );
    }
  });
});
