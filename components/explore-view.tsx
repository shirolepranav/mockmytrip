"use client";

import { useState } from "react";
import Link from "next/link";
import { PoiCard } from "@/components/poi-card";
import { PoiDetailSheet } from "@/components/poi-detail-sheet";
import { AddFromExploreSheet } from "@/components/add-from-explore-sheet";
import type { PoiCategory, PoiWithDistance } from "@/lib/services/pois";

/*
 * Explore (WF §20, REAL places): category tabs, POI grid, "city not
 * seeded" state suggesting the nearest seeded city, attribution footer.
 * Trip-scoped when `tripId`/`dayCount` are given (adds "Add to itinerary");
 * standalone from flight/hotel detail otherwise.
 */

const TAB_GROUPS: { value: string; label: string; categories: PoiCategory[] }[] = [
  { value: "all", label: "All", categories: [] },
  { value: "sights", label: "Sights", categories: ["sight", "landmark"] },
  { value: "museums", label: "Museums", categories: ["museum"] },
  { value: "food", label: "Food & Cafés", categories: ["restaurant", "cafe"] },
  { value: "viewpoints", label: "Viewpoints & Parks", categories: ["viewpoint", "park"] },
];

export function ExploreView({
  city,
  pois,
  nearestCity,
  tripId,
  dayCount,
}: {
  city: string;
  pois: PoiWithDistance[];
  nearestCity: { city: string; isoCountry: string } | null;
  tripId?: string;
  dayCount?: number;
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [selected, setSelected] = useState<PoiWithDistance | null>(null);
  const [addingPoi, setAddingPoi] = useState<PoiWithDistance | null>(null);

  if (pois.length === 0) {
    return (
      <div
        className="ticket-surface flex flex-col items-center gap-s3 p-s6 text-center"
        data-testid="explore-unseeded"
      >
        <p className="font-display text-xl">We haven&apos;t mapped this dream yet</p>
        <p className="max-w-prose text-sm text-ink-soft">
          {city} isn&apos;t in our real-places index yet.
          {nearestCity ? ` Try ${nearestCity.city}, ${nearestCity.isoCountry} instead.` : ""}
        </p>
        {nearestCity ? (
          <Link
            href={
              tripId
                ? `/trips/${tripId}/explore?city=${encodeURIComponent(nearestCity.city)}`
                : `/explore/${encodeURIComponent(nearestCity.city)}`
            }
            className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
          >
            Explore {nearestCity.city}
          </Link>
        ) : null}
      </div>
    );
  }

  const activeGroup = TAB_GROUPS.find((tab) => tab.value === activeTab) ?? TAB_GROUPS[0];
  const filtered =
    activeGroup.categories.length === 0
      ? pois
      : pois.filter((poi) => activeGroup.categories.includes(poi.category));

  const canAddToItinerary = tripId !== undefined && dayCount !== undefined;

  return (
    <div className="flex flex-col gap-s5">
      <div className="flex flex-wrap gap-s2" data-testid="explore-tabs" role="tablist">
        {TAB_GROUPS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
            data-testid={`explore-tab-${tab.value}`}
            className={`min-h-11 rounded-pill px-s4 text-sm font-semibold ${
              activeTab === tab.value
                ? "bg-ink text-paper2"
                : "border border-line text-ink hover:bg-paper2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="grid grid-cols-1 gap-s4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="explore-grid"
      >
        {filtered.map((poi) => (
          <button
            key={poi.id}
            type="button"
            onClick={() => setSelected(poi)}
            className="text-left"
            data-testid="explore-poi-card-button"
          >
            <PoiCard poi={poi} />
          </button>
        ))}
      </div>

      <PoiDetailSheet
        poi={selected}
        onClose={() => setSelected(null)}
        onAddToItinerary={
          canAddToItinerary
            ? (poi) => {
                setSelected(null);
                setAddingPoi(poi);
              }
            : undefined
        }
      />

      {canAddToItinerary && addingPoi ? (
        <AddFromExploreSheet
          poi={addingPoi}
          tripId={tripId}
          dayCount={dayCount}
          onClose={() => setAddingPoi(null)}
        />
      ) : null}

      <p className="text-xs text-ink-soft" data-testid="explore-attribution-footer">
        © OpenStreetMap contributors (ODbL) · Wikidata (CC0) · Wikivoyage (CC BY-SA)
      </p>
    </div>
  );
}
