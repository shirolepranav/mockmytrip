import type { NextConfig } from "next";

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

export default nextConfig;
