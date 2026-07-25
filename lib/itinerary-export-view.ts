import { getTrip } from "@/lib/services/trips";
import { listItineraryItems, tripLengthDays } from "@/lib/services/itinerary";
import { getPoi } from "@/lib/services/pois";

/*
 * Single source of truth for itinerary-export content (WF §14), consumed
 * by both the print-friendly page and the PDF renderer — mirrors
 * lib/boarding-pass-view.ts's "one shared data shape, multiple renderers"
 * pattern.
 */

export interface ItineraryExportItem {
  dayIndex: number;
  time: string | null;
  title: string;
  category: string;
  note: string | null;
  /** A real street address, only when sourced from an OSM-tagged POI. */
  address: string | null;
}

export interface ItineraryExportData {
  tripId: string;
  tripTitle: string;
  destinationCity: string;
  destinationCountry: string | null;
  dayCount: number;
  itemsByDay: ItineraryExportItem[][];
}

/** Ownership-checked; resolves each POI-linked item's real address, if any. */
export async function getItineraryExportData(
  userId: string,
  tripId: string,
): Promise<ItineraryExportData> {
  const trip = await getTrip(userId, tripId); // ownership check
  const items = await listItineraryItems(userId, tripId);
  const dayCount = tripLengthDays(trip);

  const itemsByDay: ItineraryExportItem[][] = Array.from({ length: dayCount }, () => []);
  for (const item of items) {
    let address: string | null = null;
    if (item.poiId) {
      const poi = await getPoi(item.poiId);
      // Only OSM-tagged POIs carry a real street address in `description`
      // (the zero-migration convention from the POI seed pipeline) —
      // Wikidata/Wikivoyage descriptions are prose, not addresses.
      if (poi && poi.source === "osm" && poi.description) {
        address = poi.description;
      }
    }
    const bucket = itemsByDay[item.dayIndex] ?? itemsByDay[dayCount - 1];
    bucket?.push({
      dayIndex: item.dayIndex,
      time: item.time,
      title: item.title,
      category: item.category,
      note: item.note,
      address,
    });
  }

  return {
    tripId,
    tripTitle: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    dayCount,
    itemsByDay,
  };
}
