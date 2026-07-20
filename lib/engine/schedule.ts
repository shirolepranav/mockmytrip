import { type Airport, hubAirports } from "./airports";
import { distanceKm } from "./distance";
import { airlineFor, type Airline } from "./names";
import { hashSeed, pick, randInt, seededRandom } from "./seed";
import { zonedToUtcMs } from "./timezone";

/*
 * Flight scheduling (TECH_SPEC §5.3): departure banks, block-time model,
 * stops rule, timezone-correct arrivals, plausible flight numbers.
 * Fully deterministic per route + date.
 */

export interface FlightStop {
  hubIata: string;
  hubCity: string;
  layoverMin: number;
}

export interface ScheduledFlight {
  airline: Airline;
  flightNumber: string;
  departUtcMs: number;
  arriveUtcMs: number;
  durationMin: number; // total incl. layover
  distanceKm: number;
  stops: FlightStop[];
}

/* Departure banks: [startHour, endHour) local at the origin. */
const BANKS: ReadonlyArray<[number, number]> = [
  [6, 9],
  [11, 14],
  [17, 21],
];

const JET_SPEED_KMH = 875;
const TURBOPROP_SPEED_KMH = 550;
const TURBOPROP_MAX_KM = 400;
const OVERHEAD_MIN = 30;
const DIRECT_MAX_KM = 4500;

/** Block time for one leg, snapped to 5 minutes. */
export function legDurationMin(legKm: number): number {
  const speed = legKm < TURBOPROP_MAX_KM ? TURBOPROP_SPEED_KMH : JET_SPEED_KMH;
  const cruiseMin = (legKm / speed) * 60;
  return Math.round((cruiseMin + OVERHEAD_MIN) / 5) * 5;
}

/** A route is "major" (always direct) when both ends are hubs. */
function isMajorRoute(origin: Airport, destination: Airport): boolean {
  const hubs = new Set(hubAirports().map((hub) => hub.iata));
  return hubs.has(origin.iata) && hubs.has(destination.iata);
}

/** Pick the connecting hub with the smallest detour that isn't an endpoint. */
function chooseHub(
  origin: Airport,
  destination: Airport,
  rand: () => number,
): Airport | undefined {
  const candidates = hubAirports()
    .filter((hub) => hub.iata !== origin.iata && hub.iata !== destination.iata)
    .map((hub) => ({
      hub,
      detour:
        distanceKm(origin, hub) +
        distanceKm(hub, destination) -
        distanceKm(origin, destination),
    }))
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 4); // best few — seeded pick keeps variety between flights
  if (candidates.length === 0) return undefined;
  return pick(rand, candidates).hub;
}

export interface ScheduleQuery {
  origin: Airport;
  destination: Airport;
  /** Departure date in the origin's local calendar. */
  year: number;
  month: number; // 1-based
  day: number;
}

/** All synthetic flights for a route on a date (3–8, seeded). */
export function flightsForDay(query: ScheduleQuery): ScheduledFlight[] {
  const { origin, destination, year, month, day } = query;
  const routeKey = `${origin.iata}-${destination.iata}`;
  const dateKey = `${year}-${month}-${day}`;
  const dayRand = seededRandom(hashSeed(`schedule:${routeKey}:${dateKey}`));

  const totalKm = distanceKm(origin, destination);
  const flightCount = randInt(dayRand, 3, 8);
  const major = isMajorRoute(origin, destination);

  const flights: ScheduledFlight[] = [];
  for (let index = 0; index < flightCount; index++) {
    const flightRand = seededRandom(
      hashSeed(`flight:${routeKey}:${dateKey}:${index}`),
    );
    const airline = airlineFor(routeKey, index);

    // Departure inside a bank, snapped to 5 minutes, with per-airline jitter.
    const [bankStart, bankEnd] = BANKS[index % BANKS.length];
    const hour = randInt(flightRand, bankStart, bankEnd - 1);
    const minute = randInt(flightRand, 0, 11) * 5;
    const departUtcMs = zonedToUtcMs(year, month, day, hour, minute, origin.tz);

    // Stops: direct when short or hub-to-hub; otherwise usually 1 stop.
    let stops: FlightStop[] = [];
    let durationMin: number;
    const wantsStop =
      totalKm >= DIRECT_MAX_KM && !major && flightRand() < 0.75;
    const hub = wantsStop
      ? chooseHub(origin, destination, flightRand)
      : undefined;
    if (hub) {
      const layoverMin = randInt(flightRand, 12, 24) * 5; // 60–120 min
      const legA = legDurationMin(distanceKm(origin, hub));
      const legB = legDurationMin(distanceKm(hub, destination));
      durationMin = legA + layoverMin + legB;
      stops = [{ hubIata: hub.iata, hubCity: hub.city, layoverMin }];
    } else {
      durationMin = legDurationMin(totalKm);
    }

    const digits = randInt(flightRand, 0, 1) + 2 + randInt(flightRand, 0, 1); // 2–4
    const flightNumber = `${airline.code}${randInt(
      flightRand,
      10 ** (digits - 1),
      10 ** digits - 1,
    )}`;

    flights.push({
      airline,
      flightNumber,
      departUtcMs,
      arriveUtcMs: departUtcMs + durationMin * 60_000,
      durationMin,
      distanceKm: Math.round(totalKm),
      stops,
    });
  }

  return flights.sort((a, b) => a.departUtcMs - b.departUtcMs);
}
