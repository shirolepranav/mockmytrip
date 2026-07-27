import { ImageResponse } from "next/og";
import { colors } from "@/lib/design/colors";

/*
 * Shared OpenGraph/Twitter card renderer (Phase 10 SEO metadata). Skips
 * custom font loading — Satori's bundled default font is enough for a
 * generated preview thumbnail, and it keeps the build immune to
 * woff2-parsing edge cases in link-unfurler renderers. Brand identity comes
 * from color, the ticket-stamp motif, and copy instead, matching
 * docs/DESIGN_SYSTEM.md's flat-offset-shadow, no-gradient identity.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          backgroundColor: colors.paper,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: colors.stampRed,
            border: `3px solid ${colors.stampRed}`,
            borderRadius: 999,
            padding: "10px 24px",
            marginBottom: 40,
          }}
        >
          Simulation — nothing here is real
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            color: colors.ink,
            lineHeight: 1.05,
          }}
        >
          Wanderlost
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: colors.inkSoft,
            marginTop: 24,
            maxWidth: 820,
          }}
        >
          All the thrill. None of the jet lag.
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 60,
            bottom: 60,
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `6px solid ${colors.horizonDeep}`,
            color: colors.horizonDeep,
            fontSize: 22,
            fontWeight: 700,
            textTransform: "uppercase",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            transform: "rotate(-12deg)",
          }}
        >
          Pretend passport
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
