import type { MetadataRoute } from "next";
import { colors } from "@/lib/design/colors";

/*
 * Web app manifest (TECH_SPEC §8, Phase 8 task 1). Colors are imported from
 * the shared token mirror — never raw hex here — so `lint:styles` stays
 * green and the manifest can never drift from the brand palette.
 */
// Required for the Capacitor static-export build (output: "export") — this
// route is genuinely static; Next just needs the explicit opt-in
// (Phase 10 dry run, TECH_SPEC §12.6).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wanderlost — All the thrill. None of the jet lag.",
    short_name: "Wanderlost",
    description:
      "A travel simulation for the joy of planning. Book pretend flights and hotels, pay $0.00, and savor the anticipation.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: colors.paper2,
    theme_color: colors.paper,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
