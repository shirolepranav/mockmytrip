import { unstable_cache } from "next/cache";
import { searchHotels } from "@/lib/engine";
import { toHotelOfferView, type HotelOfferView } from "@/lib/hotel-offer-view";

/*
 * Cached hotel-offer lookup, mirroring lib/flight-results.ts: the engine is
 * a pure, seeded function of {city, country, checkin, checkout, guests,
 * rooms}, so the raw offer list is safe to cache per-query for a short
 * window — avoids recomputing hotelsForCity on every sort/filter re-render
 * or detail-page lookup for the same search. Unlike flights, hotel pricing
 * has no "now"-dependent booking curve, so no stable-now param is needed.
 */

export interface HotelResultsQuery {
  city: string;
  country: string;
  checkin: string;
  checkout: string;
  guests: number;
  rooms: number;
}

const getCachedOffers = unstable_cache(
  async (query: HotelResultsQuery): Promise<HotelOfferView[]> =>
    searchHotels(query).map(toHotelOfferView),
  ["hotel-search"],
  { revalidate: 300, tags: ["hotel-search"] },
);

export function getHotelOffers(
  query: HotelResultsQuery,
): Promise<HotelOfferView[]> {
  return getCachedOffers(query);
}
