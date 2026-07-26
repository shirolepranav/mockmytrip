// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase9 calendar data-gathering suite against embedded in-memory PGlite.
 */

process.env.PGLITE_MEMORY = "1";

import { getDb, schema } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { addItineraryItem } from "@/lib/services/itinerary";
import { getCalendarTripData } from "./calendar";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

async function makeTripWithFlight(userId: string) {
  const trip = await createTrip(userId, {
    title: "Test trip",
    destinationCity: "Lisbon",
    destinationCountry: "PT",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-04T00:00:00Z"),
  });

  const db = await getDb();
  const [flight] = await db
    .insert(schema.flights)
    .values({
      airlineName: "Altair Airways",
      airlineCode: "AL",
      airlineHue: 200,
      airlineLogoSeed: 1,
      flightNumber: "AL123",
      originIata: "JFK",
      destIata: "LIS",
      departAt: new Date("2026-09-01T18:00:00Z"),
      arriveAt: new Date("2026-09-02T06:30:00Z"),
      durationMin: 390,
      distanceKm: 5400,
      cabin: "economy",
      priceCents: 50000,
      seed: 1,
    })
    .returning();
  await db.insert(schema.bookings).values({
    tripId: trip.id,
    userId,
    type: "flight",
    flightId: flight.id,
    pnr: "SIM-ABC123",
    priceCents: 50000,
    savedCents: 20000,
  });

  return trip;
}

describe("@phase9 getCalendarTripData", () => {
  it("returns null for a nonexistent trip", async () => {
    expect(
      await getCalendarTripData("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("gathers the trip's flight leg and itinerary days", async () => {
    const user = await createGuest();
    const trip = await makeTripWithFlight(user.id);
    await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "Pastel de nata crawl",
      category: "food",
    });
    await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "Belém Tower",
      category: "sight",
    });

    const data = await getCalendarTripData(trip.id);
    expect(data).not.toBeNull();
    expect(data!.legs).toHaveLength(1);
    expect(data!.legs[0].kind).toBe("departure");
    expect(data!.legs[0].originIata).toBe("JFK");
    expect(data!.legs[0].destCity).toBe("Lisbon");
    expect(data!.itineraryDays).toEqual([
      { dayIndex: 0, summary: "Pastel de nata crawl, Belém Tower" },
    ]);
  });
});
