// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase6 trips service suite against embedded in-memory PGlite: the new
 * Phase 6 read paths (getOutboundFlightForTrip, listStamps,
 * getPassportSummary). Kept separate from services.test.ts (scoped to its
 * existing @phase2 coverage) rather than folded in.
 */

process.env.PGLITE_MEMORY = "1";

import { getDb } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createBooking } from "./bookings";
import {
  getOutboundFlightForTrip,
  getPassportSummary,
  listStamps,
} from "./trips";
import { OwnershipError } from "./ownership";
import type { FlightOfferView } from "@/lib/offer-view";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

function makeFlightOffer(overrides: Partial<FlightOfferView> = {}): FlightOfferView {
  return {
    id: `F-${Math.random().toString(36).slice(2)}`,
    airlineName: "Test Air",
    airlineCode: "TA",
    airlineHue: 200,
    airlineLogoSeed: 12345,
    flightNumber: "123",
    originIata: "JFK",
    originCity: "New York",
    originCountry: "US",
    originTz: "America/New_York",
    destIata: "LIS",
    destCity: "Lisbon",
    destCountry: "PT",
    destTz: "Europe/Lisbon",
    departUtcMs: Date.parse("2026-08-15T10:00:00Z"),
    arriveUtcMs: Date.parse("2026-08-15T20:00:00Z"),
    durationMin: 480,
    distanceKm: 5400,
    stops: [],
    cabin: "economy",
    passengers: 1,
    priceCents: 45000,
    savedCents: 45000,
    seed: 999,
    ...overrides,
  };
}

describe("@phase6 getOutboundFlightForTrip", () => {
  it("returns the earliest flight leg for a round-trip booking", async () => {
    const user = await createGuest();
    const outbound = makeFlightOffer({
      id: "F-OUT",
      departUtcMs: Date.parse("2026-08-15T10:00:00Z"),
    });
    const inbound = makeFlightOffer({
      id: "F-IN",
      originIata: "LIS",
      destIata: "JFK",
      departUtcMs: Date.parse("2026-08-22T10:00:00Z"),
      arriveUtcMs: Date.parse("2026-08-22T18:00:00Z"),
    });
    const { tripId } = await createBooking(user.id, {
      flight: outbound,
      returnFlight: inbound,
    });

    const result = await getOutboundFlightForTrip(user.id, tripId);
    expect(result).not.toBeNull();
    expect(result?.originIata).toBe("JFK");
    expect(result?.destIata).toBe("LIS");
    expect(result?.departAt.getTime()).toBe(outbound.departUtcMs);
  });

  it("throws OwnershipError for a forged/foreign tripId", async () => {
    const user = await createGuest();
    await expect(
      getOutboundFlightForTrip(user.id, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(OwnershipError);
  });
});

describe("@phase6 listStamps / getPassportSummary", () => {
  it("returns zeros for a user with no bookings", async () => {
    const user = await createGuest();
    expect(await listStamps(user.id)).toHaveLength(0);
    const summary = await getPassportSummary(user.id);
    expect(summary).toEqual({
      stamps: [],
      countryCount: 0,
      cityCount: 0,
      totalDistanceKm: 0,
    });
  });

  it("dedupes country/city counts and sums distance across multiple stamps", async () => {
    const user = await createGuest();
    await createBooking(user.id, {
      flight: makeFlightOffer({
        id: "F-LIS-1",
        destCity: "Lisbon",
        destCountry: "PT",
        distanceKm: 5400,
      }),
    });
    await createBooking(user.id, {
      flight: makeFlightOffer({
        id: "F-LIS-2",
        destCity: "Porto",
        destCountry: "PT",
        distanceKm: 5300,
      }),
    });
    await createBooking(user.id, {
      flight: makeFlightOffer({
        id: "F-TYO",
        destCity: "Tokyo",
        destCountry: "JP",
        distanceKm: 10800,
      }),
    });

    const summary = await getPassportSummary(user.id);
    expect(summary.stamps).toHaveLength(3);
    expect(summary.countryCount).toBe(2); // PT, JP
    expect(summary.cityCount).toBe(3); // Lisbon, Porto, Tokyo
    expect(summary.totalDistanceKm).toBe(5400 + 5300 + 10800);
  });

  it("newest stamp sorts first", async () => {
    const user = await createGuest();
    await createBooking(user.id, {
      flight: makeFlightOffer({ id: "F-FIRST", destCity: "Lisbon" }),
    });
    const { tripId: secondTripId } = await createBooking(user.id, {
      flight: makeFlightOffer({ id: "F-SECOND", destCity: "Tokyo" }),
    });

    const stamps = await listStamps(user.id);
    expect(stamps[0].tripId).toBe(secondTripId);
  });
});
