import { destinationArtFor } from "@/lib/engine/destination-art";

/* Generated destination scene (safe: engine SVG is fully synthetic). */
export function DestinationArt({
  seed,
  size = 320,
  className,
}: {
  seed: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block overflow-hidden ${className ?? ""}`}
      dangerouslySetInnerHTML={{
        __html: destinationArtFor(seed, { size }),
      }}
    />
  );
}
