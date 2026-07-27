import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const isNative = process.env.NEXT_PUBLIC_IS_NATIVE === "true";

/*
 * Security headers (Phase 10 task, TECH_SPEC §11 "secure headers via
 * next.config"). CSP is built only from what this app actually loads: no
 * external <script> tags anywhere, fonts are self-hosted
 * @fontsource-variable packages (no Google Fonts CDN), GSAP/confetti are
 * dynamic-imported same-origin chunks. connect-src allowlists Sentry's
 * ingest host. style-src needs 'unsafe-inline' because GSAP/Motion set
 * inline style attributes at runtime.
 *
 * Shipped as Report-Only until every route has been smoke-tested against
 * the policy (Phase 10 rollout safety) — flip via CSP_ENFORCE=true once
 * verified, before the production release tag.
 */
const cspIsEnforcing = process.env.CSP_ENFORCE === "true";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Chrome logs a console error/DevTools Issue for this directive under a
  // Report-Only policy ("ignored when delivered in a report-only policy")
  // — confirmed via Lighthouse's errors-in-console/inspector-issues
  // audits during Phase 10. Only meaningful once actually enforcing.
  ...(cspIsEnforcing ? ["upgrade-insecure-requests"] : []),
].join("; ");

const cspHeaderName = cspIsEnforcing
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: cspHeaderName, value: cspDirectives },
];

async function headers() {
  return [{ source: "/:path*", headers: securityHeaders }];
}

const nextConfig: NextConfig = {
  // PGlite (embedded dev DB) loads its own WASM — must stay unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Capacitor dual-target (TECH_SPEC §12.2): static export for native builds.
  // headers() is a runtime server feature and Next.js errors if it's combined
  // with output:"export" (TECH_SPEC §12.6), so it only applies on the web
  // branch — the native app ships without HTTP headers to set in the first
  // place (it's a bundled WKWebView asset, not a served response).
  ...(isNative
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : { headers }),
};

/*
 * Serwist (Phase 8 task 1, TECH_SPEC §8) only makes sense for the web
 * target — a Capacitor static-export build never registers a Service
 * Worker (see lib/platform.ts / components/sw-register.tsx), so skip
 * wrapping the config with it entirely on that branch. `register: false`
 * because SwRegister does the registration itself, after the native-
 * platform guard.
 *
 * Also skipped entirely in dev: @serwist/next attaches a webpack() config
 * function unconditionally (its own `disable` option only skips the SW
 * build step, not that attachment), and Next.js 16 defaults `next dev` to
 * Turbopack, which refuses to start at all when it sees an unmigrated
 * custom webpack config. Since the SW is disabled in dev anyway (task 1),
 * there's nothing lost by leaving Turbopack dev alone — only `next build`
 * needs `--webpack` (see package.json's `build` script).
 */
const isDev = process.env.NODE_ENV === "development";

const configWithPwa = isNative || isDev
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      register: false,
    })(nextConfig);

// Bundle analyzer (Phase 10 task 2 / QA 10.2) — no-op unless ANALYZE=true,
// so it never affects a normal `next build`. Run via `npm run analyze`.
const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});
const configWithAnalyzer = withBundleAnalyzer(configWithPwa);

/*
 * Sentry (Phase 10 task, error tracking only — see instrumentation.ts for
 * the init call and its ethics-guardrails constraints: no Session Replay,
 * no PII, no analytics products). Skipped on the native static-export
 * target — there's no Node server to report from there, and
 * instrumentation.ts's server-side Sentry.init() is itself gated the same
 * way (TECH_SPEC §12.6). Left active in dev so errors are visible locally;
 * source-map upload simply no-ops without SENTRY_AUTH_TOKEN.
 */
export default isNative
  ? configWithAnalyzer
  : withSentryConfig(configWithAnalyzer, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    });
