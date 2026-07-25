"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Toast } from "@/components/toast";
import { addItineraryItemAction } from "@/actions/itinerary";
import type { ItineraryCategory } from "@/lib/services/itinerary";
import type { PoiCategory, PoiWithDistance } from "@/lib/services/pois";

/*
 * "Add from Explore" day-picker (WF §14/§20): shared by the Explore page's
 * "Add to itinerary" and the itinerary builder's own "Add from Explore"
 * entry point. Inserts a POI-linked itinerary item (`poi_id` set).
 */

const POI_TO_ITINERARY_CATEGORY: Record<PoiCategory, ItineraryCategory> = {
  sight: "sight",
  landmark: "sight",
  museum: "sight",
  viewpoint: "sight",
  restaurant: "food",
  cafe: "food",
  park: "activity",
};

export function AddFromExploreSheet({
  poi,
  tripId,
  dayCount,
  onClose,
}: {
  poi: PoiWithDistance;
  tripId: string;
  dayCount: number;
  onClose: () => void;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    const created = await addItineraryItemAction({
      tripId,
      dayIndex,
      title: poi.name,
      category: POI_TO_ITINERARY_CATEGORY[poi.category],
      poiId: poi.id,
    });
    setSubmitting(false);
    if (created) {
      setSuccess(true);
      setTimeout(onClose, 1200);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={`Add "${poi.name}" to a day`}
        testId="add-from-explore-sheet"
      >
        <div className="flex flex-col gap-s4">
          <div
            className="flex flex-wrap gap-s2"
            role="radiogroup"
            aria-label="Choose a day"
          >
            {Array.from({ length: dayCount }, (_, index) => (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={dayIndex === index}
                onClick={() => setDayIndex(index)}
                data-testid={`add-from-explore-day-${index}`}
                className={`min-h-11 rounded-pill px-s4 text-sm font-semibold ${
                  dayIndex === index
                    ? "bg-ink text-paper2"
                    : "border border-line text-ink hover:bg-paper2"
                }`}
              >
                Day {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="add-from-explore-confirm"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2 disabled:opacity-60"
          >
            {submitting ? "Adding…" : `Add to Day ${dayIndex + 1}`}
          </button>
        </div>
      </Sheet>
      {success ? <Toast tone="success" message={`Added to Day ${dayIndex + 1}`} /> : null}
    </>
  );
}
