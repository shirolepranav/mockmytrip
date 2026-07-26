import { expect, test, type Page } from "@playwright/test";

/*
 * @phase8 e2e: web push subscribe/unsubscribe and the cron auth contract —
 * QA 8.6/8.7 from docs/IMPLEMENTATION_PLAN.md.
 *
 * Scope note: a real Web Push handshake (Notification.requestPermission +
 * pushManager.subscribe against a live push service) can't run against the
 * dev server used here — the Service Worker is disabled in dev by design
 * (see phase8-pwa-offline.spec.ts), and PushOptInToggle itself bails
 * gracefully with no registration to subscribe through. What e2e CAN
 * uniquely verify is the actual HTTP contract: the subscribe/unsubscribe
 * route persists (and removes) a row and flips notifOptIn, and the cron
 * route's bearer-token auth actually gates it. Milestone-matching, the
 * 1/day cap, and dead-subscription pruning are exhaustively covered at the
 * unit level (lib/services/push.test.ts) with `web-push` mocked, since a
 * fake subscription endpoint here would just fail silently against a real
 * (nonexistent) push service rather than exercising that logic honestly.
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

/** Establishes a real session cookie the same way every other suite does. */
async function establishSession(page: Page) {
  await page.goto("/search/flights");
  await pickAirport(page, "From", "JFK");
  await pickAirport(page, "To", "LIS");
  await page.getByLabel("Departure").fill(isoDaysFromNow(10));
  await page.getByTestId("search-flights-submit").click();
  await page.getByTestId("flight-card").first().click();
  await page.getByTestId("select-flight-submit").click();
  await page.waitForURL(/\/search\/hotels$/);
  await page.getByTestId("skip-hotels-submit").click();
  await page.waitForURL(/\/trip\/summary$/);
}

test.describe("@phase8 Push subscribe/unsubscribe", () => {
  test("8.6 subscribing creates a row and opts in; unsubscribing removes it and opts out", async ({
    page,
  }) => {
    await establishSession(page);
    const endpoint = "https://push.example.test/e2e-endpoint";

    const subscribeResponse = await page.request.post("/api/push/subscribe", {
      data: { endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } },
    });
    expect(subscribeResponse.ok()).toBe(true);

    let exported = await (await page.request.get("/api/export")).json();
    expect(exported.user.prefsJson.notifOptIn).toBe(true);

    const unsubscribeResponse = await page.request.delete("/api/push/subscribe", {
      data: { endpoint },
    });
    expect(unsubscribeResponse.ok()).toBe(true);

    exported = await (await page.request.get("/api/export")).json();
    expect(exported.user.prefsJson.notifOptIn).toBe(false);
  });

  test("subscribing without a session is rejected", async ({ page }) => {
    const response = await page.request.post("/api/push/subscribe", {
      data: {
        endpoint: "https://push.example.test/no-session",
        keys: { p256dh: "x", auth: "y" },
      },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("@phase8 Push send cron auth", () => {
  test("8.7 missing or wrong bearer token is rejected", async ({ page }) => {
    const noAuth = await page.request.get("/api/push/send");
    expect(noAuth.status()).toBe(401);

    const wrongAuth = await page.request.get("/api/push/send", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(wrongAuth.status()).toBe(401);
  });
});
