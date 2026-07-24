import { unstable_cache } from "next/cache";
import { searchFlights, type Cabin } from "@/lib/engine";
import { toOfferView, type FlightOfferView } from "@/lib/offer-view";
import { startOfTodayUtcMs } from "@/lib/search-params";

/*
 * Cached flight-offer lookup (Phase 3 task 3): the engine is a pure,
 * seeded function of {origin, destination, departDate, passengers, cabin}
 * plus "today," so the raw offer list is safe to cache per-query for a
 * short window — avoids recomputing flightsForDay + pricing on every
 * sort/filter re-render, back-navigation, or detail-page lookup for the
 * same search. Sort/filter stay uncached since they must react instantly.
 */

export interface FlightResultsQuery {
  origin: string;
  destination: string;
  departDate: string;
  passengers: number;
  cabin: Cabin;
}

const getCachedOffers = unstable_cache(
  async (query: FlightResultsQuery): Promise<FlightOfferView[]> =>
    searchFlights(query, startOfTodayUtcMs()).map(toOfferView),
  ["flight-search"],
  { revalidate: 300, tags: ["flight-search"] },
);

export function getFlightOffers(
  query: FlightResultsQuery,
): Promise<FlightOfferView[]> {
  return getCachedOffers(query);
}
