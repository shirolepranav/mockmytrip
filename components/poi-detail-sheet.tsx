"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { mapSketchFor } from "@/lib/engine/destination-art";
import { IconMapPin } from "@/components/icons";
import { hashSeed } from "@/lib/engine/seed";
import type { PoiWithDistance } from "@/lib/services/pois";

/* POI detail sheet (WF §20): full description, illustrative locator (never
   a real map embed), attribution, "Add to itinerary". */
export function PoiDetailSheet({
  poi,
  onClose,
  onAddToItinerary,
}: {
  poi: PoiWithDistance | null;
  onClose: () => void;
  onAddToItinerary?: (poi: PoiWithDistance) => void;
}) {
  const [displayPoi, setDisplayPoi] = useState<PoiWithDistance | null>(poi);
  if (poi !== null && poi !== displayPoi) {
    setDisplayPoi(poi);
  }

  return (
    <Sheet
      open={poi !== null}
      onClose={onClose}
      title={displayPoi?.name}
      testId="poi-detail-sheet"
    >
      {displayPoi ? (
        <div className="flex flex-col gap-s3">
          <span
            aria-hidden
            className="block overflow-hidden rounded-card border border-line"
            dangerouslySetInnerHTML={{
              __html: mapSketchFor(hashSeed(displayPoi.id), { size: 240 }),
            }}
          />
          <p className="flex items-center gap-s1 text-xs text-ink-soft">
            <IconMapPin size={14} />
            Illustrative sketch — not a real map
          </p>
          <span
            data-testid="poi-real-place-chip"
            className="w-fit rounded-pill bg-mint-ok/20 px-s3 py-1 text-xs font-bold text-mint-ok"
          >
            Real place
          </span>
          {displayPoi.description ? (
            <p className="text-sm text-ink-soft">{displayPoi.description}</p>
          ) : null}
          {displayPoi.distanceFromCenterKm !== null ? (
            <p className="text-xs text-ink-soft">
              {displayPoi.distanceFromCenterKm.toFixed(1)} km from city center
            </p>
          ) : null}
          <p data-testid="poi-attribution" className="text-xs text-ink-soft">
            {displayPoi.attribution}
          </p>
          {onAddToItinerary ? (
            <button
              type="button"
              onClick={() => onAddToItinerary(displayPoi)}
              data-testid="poi-detail-add-to-itinerary"
              className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
            >
              Add to itinerary
            </button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
