import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wanderlost.app";

/*
 * Only static, non-personal routes (Phase 10 SEO). /trips, /trip/*, and
 * /s/[token] are deliberately excluded — they're private or revocable by
 * design (golden rule #10) and indexing them would serve no one.
 */
const STATIC_ROUTES = ["", "/about", "/privacy"];

// Required for the Capacitor static-export build (output: "export") — this
// route is genuinely static; Next just needs the explicit opt-in
// (Phase 10 dry run, TECH_SPEC §12.6).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
  }));
}
