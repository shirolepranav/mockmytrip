import { z } from "zod";
import type { FlightOffer } from "@/lib/engine";

/*
 * Serializable flight-offer view model: what crosses the server→client
 * boundary and what gets stored in the trip draft. Plain data only. The
 * schema is the single source of truth — actions/trips.ts and the trip
 * summary re-parse a stored draft against it instead of trusting the JSON.
 */

export const flightOfferViewSchema = z.object({
  id: z.string(),
  airlineName: z.string(),
  airlineCode: z.string(),
  airlineHue: z.number(),
  airlineLogoSeed: z.number(),
  flightNumber: z.string(),
  originIata: z.string(),
  originCity: z.string(),
  originCountry: z.string(),
  originTz: z.string(),
  destIata: z.string(),
  destCity: z.string(),
  destCountry: z.string(),
  destTz: z.string(),
  departUtcMs: z.number(),
  arriveUtcMs: z.number(),
  durationMin: z.number(),
  distanceKm: z.number(),
  stops: z.array(
    z.object({
      hubIata: z.string(),
      hubCity: z.string(),
      layoverMin: z.number(),
    }),
  ),
  cabin: z.string(),
  passengers: z.number(),
  priceCents: z.number(),
  savedCents: z.number(),
  seed: z.number(),
});

export type FlightOfferView = z.infer<typeof flightOfferViewSchema>;

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
