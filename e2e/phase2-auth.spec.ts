import { expect, test } from "@playwright/test";

/*
 * @phase2 e2e: guest-first session through the real UI, export & delete.
 * (Magic-link merge is covered by unit tests — no inbox in CI.)
 */

test.describe("@phase2 guest session", () => {
  test("acknowledge creates a guest session cookie (httpOnly, lax)", async ({
    page,
    context,
  }) => {
    await page.goto("/welcome");
    await page
      .getByRole("button", { name: /i understand — let'?s dream/i })
      .click();
    await page.waitForURL("**/search/flights");

    const cookie = (await context.cookies()).find(
      (c) => c.name === "wl_session",
    );
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Second acknowledge keeps the same user (no duplicate rows → same value).
    await page.goto("/welcome");
    await page
      .getByRole("button", { name: /i understand — let'?s dream/i })
      .click();
    await page.waitForURL("**/search/flights");
    const cookieAfter = (await context.cookies()).find(
      (c) => c.name === "wl_session",
    );
    expect(cookieAfter?.value).toBe(cookie?.value);
  });

  test("export requires a session; returns only this user's data", async ({
    page,
  }) => {
    const anonymous = await page.request.get("/api/export");
    expect(anonymous.status()).toBe(401);

    await page.goto("/welcome");
    await page
      .getByRole("button", { name: /i understand — let'?s dream/i })
      .click();
    await page.waitForURL("**/search/flights");

    const response = await page.request.get("/api/export");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.note).toContain("SIMULATION");
    expect(body.user.isGuest).toBe(true);
  });

  test("delete-all clears the session and data", async ({ page, context }) => {
    await page.goto("/welcome");
    await page
      .getByRole("button", { name: /i understand — let'?s dream/i })
      .click();
    await page.waitForURL("**/search/flights");

    await page.goto("/settings");
    await page.getByRole("button", { name: /delete all my data/i }).click();
    await page
      .getByRole("button", { name: /yes, delete everything/i })
      .click();
    await page.waitForURL(/\/$/);

    const cookie = (await context.cookies()).find(
      (c) => c.name === "wl_session",
    );
    expect(cookie).toBeUndefined();
    const response = await page.request.get("/api/export");
    expect(response.status()).toBe(401);
  });
});
