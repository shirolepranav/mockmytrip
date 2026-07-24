import { flightOfferViewSchema, type FlightOfferView } from "@/lib/offer-view";
import { hotelOfferViewSchema, type HotelOfferView } from "@/lib/hotel-offer-view";
import type { TripDraft } from "@/lib/services/trips";

/*
 * Pure trip-draft summary (Phase 4 task 5): assembles the accumulated
 * flight(s) + optional hotel into totals and missing-piece flags for the
 * trip summary page. Tolerates missing/malformed draft fields (never
 * throws) since a draft is untyped jsonb until it's re-parsed here.
 */

export interface TripSummary {
  flight: FlightOfferView | null;
  returnFlight: FlightOfferView | null;
  hotel: HotelOfferView | null;
  hasFlight: boolean;
  hasReturnFlight: boolean;
  hasHotel: boolean;
  /** Outbound + return flight price, both passengers-inclusive. */
  flightTotalCents: number;
  /** Hotel total for the full stay × rooms (already computed by searchHotels). */
  hotelTotalCents: number;
  grandTotalCents: number;
  totalSavedCents: number;
  nights: number;
  destinationCity: string | null;
  /** User-edited title, if one was saved to the draft. */
  title: string | null;
}

export function summarizeDraft(
  draft: TripDraft | null | undefined,
): TripSummary {
  const flightResult = flightOfferViewSchema.safeParse(draft?.flight);
  const returnResult = flightOfferViewSchema.safeParse(draft?.returnFlight);
  const hotelResult = hotelOfferViewSchema.safeParse(draft?.hotel);

  const flight = flightResult.success ? flightResult.data : null;
  const returnFlight = returnResult.success ? returnResult.data : null;
  const hotel = hotelResult.success ? hotelResult.data : null;

  const flightTotalCents =
    (flight?.priceCents ?? 0) + (returnFlight?.priceCents ?? 0);
  const hotelTotalCents = hotel?.totalCents ?? 0;
  const totalSavedCents =
    (flight?.savedCents ?? 0) +
    (returnFlight?.savedCents ?? 0) +
    (hotel?.savedCents ?? 0);

  const rawTitle = draft?.title;
  const title =
    typeof rawTitle === "string" && rawTitle.trim().length > 0
      ? rawTitle
      : null;

  return {
    flight,
    returnFlight,
    hotel,
    hasFlight: flight !== null,
    hasReturnFlight: returnFlight !== null,
    hasHotel: hotel !== null,
    flightTotalCents,
    hotelTotalCents,
    grandTotalCents: flightTotalCents + hotelTotalCents,
    totalSavedCents,
    nights: hotel?.nights ?? 0,
    destinationCity: flight?.destCity ?? null,
    title,
  };
}

/** "5 days in Lisbon" / "1 day in Lisbon" / "Trip to Lisbon" (no hotel yet). */
export function generateTripTitle(city: string, nights: number): string {
  if (nights <= 0) return `Trip to ${city}`;
  return `${nights} day${nights === 1 ? "" : "s"} in ${city}`;
}
