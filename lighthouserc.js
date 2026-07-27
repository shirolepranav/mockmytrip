/*
 * Lighthouse CI config (Phase 10 task 8, QA 10.1/10.8). A JS module (not
 * lighthouserc.json) so it can read `process.env` — CI supplies
 * LH_FIXTURE_COOKIE (from scripts/seed-lighthouse-fixture.mts) so
 * /trip/checkout and /trips are measured as their real logged-in pages,
 * not the anonymous redirect. Local `npm run lh` runs the same 4 URLs
 * without a cookie — checkout/trips will just measure the redirected
 * /search/flights page in that case, which is still a useful quick local
 * check even without running the fixture script first.
 *
 * PWA category: Lighthouse removed the aggregate "pwa" scored category in
 * v11+ (not present in this project's Lighthouse 12.6.1 default config at
 * all — confirmed by grepping node_modules/lighthouse's default-config.js
 * during Phase 10), so there is no `categories:pwa` assertion to make
 * here. PWA installability (manifest + service worker + install prompt)
 * is covered instead by e2e/phase8-pwa-offline.spec.ts.
 */
const fixtureCookie = process.env.LH_FIXTURE_COOKIE ?? "";

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready",
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/search/flights/results?o=JFK&d=LIS&depart=2026-09-01&pax=1&cabin=economy",
        "http://localhost:3000/trip/checkout",
        "http://localhost:3000/trips",
      ],
      numberOfRuns: 1,
      settings: {
        // No `preset: "perf"` — that preset runs performance audits ONLY
        // and skips accessibility/best-practices entirely (confirmed:
        // the original config had this exact bug, which is why those two
        // categories always silently reported "0 audits ran" instead of
        // a real score — this Lighthouse CI setup had never actually been
        // exercised end-to-end before Phase 10 wired it into CI).
        emulatedFormFactor: "mobile",
        ...(fixtureCookie
          ? { extraHeaders: { Cookie: fixtureCookie } }
          : {}),
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
      },
    },
  },
};
