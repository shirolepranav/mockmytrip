import { z } from "zod";
import { byIata, type Airport } from "./airports";
import { flightsForDay, type FlightStop } from "./schedule";
import { priceFlight, type Cabin, CABIN_MULTIPLIERS } from "./pricing";
import { hotelsForCity, type HotelOffer } from "./hotels";
import type { Airline } from "./names";
import { hashSeed } from "./seed";

/*
 * Public engine API (Phase 1 task 8): searchFlights / searchHotels.
 * Deterministic: the same validated query always returns deep-equal results
 * (pass `now` for a stable booking curve in tests).
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const flightQuerySchema = z
  .object({
    origin: z.string().length(3),
    destination: z.string().length(3),
    departDate: isoDate,
    passengers: z.number().int().min(1).max(9).default(1),
    cabin: z
      .enum(["economy", "premium", "business", "first"])
      .default("economy"),
  })
  .refine(
    (query) => query.origin.toUpperCase() !== query.destination.toUpperCase(),
    { message: "Origin and destination must differ", path: ["destination"] },
  );

export type FlightQuery = z.infer<typeof flightQuerySchema>;

export interface FlightOffer {
  id: string;
  airline: Airline;
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  departUtcMs: number;
  arriveUtcMs: number;
  durationMin: number;
  distanceKm: number;
  stops: FlightStop[];
  cabin: Cabin;
  passengers: number;
  /** Total for all passengers. */
  priceCents: number;
  savedCents: number;
  seed: number;
}

export class UnknownAirportError extends Error {
  constructor(iata: string) {
    super(`Unknown airport code: ${iata}`);
    this.name = "UnknownAirportError";
  }
}

export function searchFlights(
  input: FlightQuery,
  nowMs?: number,
): FlightOffer[] {
  const query = flightQuerySchema.parse(input);
  const origin = byIata(query.origin);
  const destination = byIata(query.destination);
  if (!origin) throw new UnknownAirportError(query.origin);
  if (!destination) throw new UnknownAirportError(query.destination);

  const [year, month, day] = query.departDate.split("-").map(Number);
  const scheduled = flightsForDay({ origin, destination, year, month, day });

  return scheduled.map((flight) => {
    const perSeat = priceFlight({
      distanceKm: flight.distanceKm,
      departUtcMs: flight.departUtcMs,
      cabin: query.cabin,
      jitterKey: `${origin.iata}-${destination.iata}:${query.departDate}:${flight.flightNumber}`,
      nowMs,
    });
    const priceCents = perSeat.priceCents * query.passengers;
    return {
      id: `F-${hashSeed(
        `${origin.iata}-${destination.iata}:${query.departDate}:${flight.flightNumber}:${query.cabin}`,
      )
        .toString(36)
        .toUpperCase()}`,
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      origin,
      destination,
      departUtcMs: flight.departUtcMs,
      arriveUtcMs: flight.arriveUtcMs,
      durationMin: flight.durationMin,
      distanceKm: flight.distanceKm,
      stops: flight.stops,
      cabin: query.cabin,
      passengers: query.passengers,
      priceCents,
      savedCents: priceCents,
      seed: hashSeed(`${origin.iata}-${destination.iata}:${query.departDate}`),
    };
  });
}

export const hotelQuerySchema = z
  .object({
    city: z.string().min(1),
    country: z.string().length(2),
    checkin: isoDate,
    checkout: isoDate,
    guests: z.number().int().min(1).max(9).default(2),
    rooms: z.number().int().min(1).max(4).default(1),
  })
  .refine((query) => query.checkout > query.checkin, {
    message: "Checkout must be after checkin",
    path: ["checkout"],
  });

export type HotelQuery = z.infer<typeof hotelQuerySchema>;

export function searchHotels(input: HotelQuery): HotelOffer[] {
  const query = hotelQuerySchema.parse(input);
  const [year, month, day] = query.checkin.split("-").map(Number);
  const nights = Math.round(
    (Date.parse(query.checkout) - Date.parse(query.checkin)) / 86_400_000,
  );
  const offers = hotelsForCity({
    city: query.city,
    country: query.country.toUpperCase(),
    year,
    month,
    day,
    nights,
  });
  // Price for the requested room count.
  return offers.map((offer) => ({
    ...offer,
    totalCents: offer.totalCents * query.rooms,
    savedCents: offer.savedCents * query.rooms,
  }));
}

export { CABIN_MULTIPLIERS };
export type { Airport, Airline, Cabin, FlightStop, HotelOffer };
