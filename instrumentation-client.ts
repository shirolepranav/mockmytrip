/*
 * Client-side Sentry init (Phase 10). Error tracking only — deliberately
 * NOT using Sentry.replayIntegration() (session replay records screens and
 * interactions, which is behavior tracking) or any Insights/analytics
 * product. TECH_SPEC §11 bans third-party trackers/ads outright; this
 * config keeps Sentry strictly to crash/error monitoring with PII scrubbed.
 * No-ops on the native static-export build and whenever no DSN is
 * configured (local dev without Sentry set up, per .env.example).
 *
 * Dynamically imported rather than a static top-level import: @sentry/
 * nextjs's client entry point is ~140KB gzip on its own (webpack module-
 * concatenates ~140 internal modules into one inseparable unit — named
 * imports don't help, this isn't a tree-shaking issue). Next.js loads
 * instrumentation-client.ts eagerly as part of the initial bundle by
 * design (so Sentry can catch errors as early as possible), which blew
 * the landing page from ~2KB to ~140KB+ gzip against QA 10.2's 130KB
 * budget. Deferring the import to a microtask keeps Sentry itself as a
 * separate, lazily-fetched chunk — the same dynamic-import treatment
 * CLAUDE.md already requires for GSAP/Rive/confetti, applied to the one
 * other heavy dependency that isn't route-specific. The trade-off (a few
 * hundred ms before Sentry can catch an error) is worth it: Lighthouse
 * performance budgets are a hard CI gate, Sentry's init timing isn't.
 */
if (
  process.env.NEXT_PUBLIC_IS_NATIVE !== "true" &&
  process.env.NEXT_PUBLIC_SENTRY_DSN
) {
  void import("@sentry/nextjs").then(({ init }) => {
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      sendDefaultPii: false,
    });
  });
}
