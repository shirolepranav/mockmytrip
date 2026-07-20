import { defineConfig, devices } from "@playwright/test";

/*
 * E2E config (IMPLEMENTATION_PLAN "Testing infrastructure"):
 * three device projects — iPhone 14 (390×844), iPad gen 10 (820×1180),
 * Desktop Chrome. Specs are tagged @phaseN; run a phase's regression with
 * `npm run e2e -- --grep @phaseN`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
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
