import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isNative = process.env.NEXT_PUBLIC_IS_NATIVE === "true";

const nextConfig: NextConfig = {
  // PGlite (embedded dev DB) loads its own WASM — must stay unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Capacitor dual-target (TECH_SPEC §12.2): static export for native builds.
  ...(isNative
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
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

export default isNative || isDev
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      register: false,
    })(nextConfig);
