import type { PoiWithDistance } from "@/lib/services/pois";

/*
 * PoiCard (WF §20): real name, description, distance, "Real place" chip
 * (always), attribution line (always). Never a price or rating — the
 * `pois` schema simply has no such field to leak (ethical-guardrails).
 */

const CATEGORY_LABELS: Record<string, string> = {
  sight: "Sight",
  landmark: "Landmark",
  museum: "Museum",
  restaurant: "Restaurant",
  cafe: "Café",
  viewpoint: "Viewpoint",
  park: "Park",
};

export function PoiCard({
  poi,
  onAddToItinerary,
}: {
  poi: PoiWithDistance;
  onAddToItinerary?: (poi: PoiWithDistance) => void;
}) {
  return (
    <div className="ticket-surface flex flex-col gap-s2 p-s4" data-testid="poi-card">
      <div className="flex items-center justify-between gap-s2">
        <span className="rounded-pill bg-paper2 px-s3 py-1 text-xs font-semibold text-ink-soft">
          {CATEGORY_LABELS[poi.category] ?? poi.category}
        </span>
        <span
          data-testid="poi-real-place-chip"
          className="rounded-pill bg-mint-ok/20 px-s3 py-1 text-xs font-bold text-mint-ok"
        >
          Real place
        </span>
      </div>
      <p className="font-display text-lg">{poi.name}</p>
      {poi.description ? (
        <p className="line-clamp-2 text-sm text-ink-soft">{poi.description}</p>
      ) : null}
      {poi.distanceFromCenterKm !== null ? (
        <p className="text-xs text-ink-soft">
          {poi.distanceFromCenterKm.toFixed(1)} km from city center
        </p>
      ) : null}
      <p data-testid="poi-attribution" className="text-xs text-ink-soft">
        {poi.attribution}
      </p>
      {onAddToItinerary ? (
        <button
          type="button"
          onClick={() => onAddToItinerary(poi)}
          data-testid="poi-add-to-itinerary"
          className="press-physical mt-s2 inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s4 text-sm font-semibold text-ink hover:bg-paper2"
        >
          Add to itinerary
        </button>
      ) : null}
    </div>
  );
}
