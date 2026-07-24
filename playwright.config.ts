import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/*
 * E2E config (IMPLEMENTATION_PLAN "Testing infrastructure"):
 * three device projects — iPhone 14 (390×844), iPad gen 10 (820×1180),
 * Desktop Chrome. Specs are tagged @phaseN; run a phase's regression with
 * `npm run e2e -- --grep @phaseN`.
 */

// Shared secret for the dev/test-only trip-seeding endpoint
// (app/api/test/seed-trip/route.ts). Set here (not a committed .env) so it
// only ever exists in this local process tree: this config process, the
// `npm run dev` server it spawns below, and the test worker processes —
// all of which inherit process.env from here. Never set in production.
process.env.TEST_SEED_SECRET ??= "wanderlost-e2e-seed-secret";

// Some sandboxed CI runners pre-install a single Chromium build at a fixed
// path instead of the exact revision this @playwright/test version expects
// (and block `playwright install` from fetching the matching one). Point at
// it when present; everywhere else this is a no-op and Playwright resolves
// its normal cached/downloaded browser.
const sandboxChromium = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(sandboxChromium)
  ? { executablePath: sandboxChromium }
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions,
  },
  projects: [
    // Chromium emulation for all three so CI needs only one browser install.
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
    {
      name: "ipad-gen10",
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
