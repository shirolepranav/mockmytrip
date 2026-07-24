import { logoFor } from "@/lib/engine/logo";

/* Generated geometric airline mark (safe: engine SVG is fully synthetic). */
export function AirlineMark({
  logoSeed,
  hue,
  size = 40,
}: {
  logoSeed: number;
  hue: number;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 overflow-hidden rounded-pill border border-line bg-paper2"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{
        __html: logoFor(logoSeed, { hue, size }),
      }}
    />
  );
}
