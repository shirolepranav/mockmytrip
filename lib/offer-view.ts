import type { FlightOffer } from "@/lib/engine";

/*
 * Serializable flight-offer view model: what crosses the server→client
 * boundary and what gets stored in the trip draft. Plain data only.
 */

export interface FlightOfferView {
  id: string;
  airlineName: string;
  airlineCode: string;
  airlineHue: number;
  airlineLogoSeed: number;
  flightNumber: string;
  originIata: string;
  originCity: string;
  originCountry: string;
  originTz: string;
  destIata: string;
  destCity: string;
  destCountry: string;
  destTz: string;
  departUtcMs: number;
  arriveUtcMs: number;
  durationMin: number;
  distanceKm: number;
  stops: { hubIata: string; hubCity: string; layoverMin: number }[];
  cabin: string;
  passengers: number;
  priceCents: number;
  savedCents: number;
  seed: number;
}

export function toOfferView(offer: FlightOffer): FlightOfferView {
  return {
    id: offer.id,
    airlineName: offer.airline.name,
    airlineCode: offer.airline.code,
    airlineHue: offer.airline.hue,
    airlineLogoSeed: offer.airline.logoSeed,
    flightNumber: offer.flightNumber,
    originIata: offer.origin.iata,
    originCity: offer.origin.city,
    originCountry: offer.origin.country,
    originTz: offer.origin.tz,
    destIata: offer.destination.iata,
    destCity: offer.destination.city,
    destCountry: offer.destination.country,
    destTz: offer.destination.tz,
    departUtcMs: offer.departUtcMs,
    arriveUtcMs: offer.arriveUtcMs,
    durationMin: offer.durationMin,
    distanceKm: offer.distanceKm,
    stops: offer.stops,
    cabin: offer.cabin,
    passengers: offer.passengers,
    priceCents: offer.priceCents,
    savedCents: offer.savedCents,
    seed: offer.seed,
  };
}
