import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wanderlost.app";

// Required for the Capacitor static-export build (output: "export") — this
// route is genuinely static; Next just needs the explicit opt-in
// (Phase 10 dry run, TECH_SPEC §12.6).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /dev is the internal component gallery (excluded from production
      // builds entirely, see app/dev/layout.tsx); /api and /auth are not
      // pages. None of these are worth crawling even where they do resolve.
      disallow: ["/dev", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
