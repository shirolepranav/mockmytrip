import { expect, test } from "@playwright/test";

/*
 * @phase10 e2e: security headers (next.config.ts `headers()`). Regression
 * guard so a future refactor of next.config.ts can't silently drop the
 * headers — mirrors the standing e2e/ethics/* pattern of asserting an
 * invariant directly against the served response rather than trusting the
 * config file alone.
 */

const REQUIRED_HEADERS: Record<string, RegExp> = {
  "x-content-type-options": /^nosniff$/,
  "x-frame-options": /^DENY$/,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "permissions-policy": /geolocation=\(\)/,
  "strict-transport-security": /max-age=\d+/,
};

test.describe("@phase10 security headers", () => {
  for (const path of ["/", "/trip/checkout"]) {
    test(`security headers present on ${path}`, async ({ request }) => {
      const response = await request.get(path);
      for (const [header, expected] of Object.entries(REQUIRED_HEADERS)) {
        const value = response.headers()[header];
        expect(value, `missing/incorrect ${header} on ${path}`).toMatch(expected);
      }
      // CSP ships as Report-Only until every route is smoke-tested; either
      // header name is acceptable here, but one of the two must be present.
      const csp =
        response.headers()["content-security-policy"] ??
        response.headers()["content-security-policy-report-only"];
      expect(csp, `missing CSP on ${path}`).toContain("default-src 'self'");
    });
  }
});
