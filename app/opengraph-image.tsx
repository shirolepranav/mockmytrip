import { OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Wanderlost — All the thrill. None of the jet lag.";
export const size = OG_SIZE;
export const contentType = "image/png";
// Required for the Capacitor static-export build (output: "export") — this
// route has no dynamic params, so it's genuinely static; Next just needs
// the explicit opt-in (TECH_SPEC §12.6).
export const dynamic = "force-static";

export default async function Image() {
  return renderOgImage();
}
