// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase5 bookings service suite against embedded in-memory PGlite:
 * QA 5.3/5.4/5.9 plus the transaction/idempotency correctness the plan
 * flagged as the phase's highest-risk area.
 */

process.env.PGLITE_MEMORY = "1";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { createGuest, getUser } from "@/lib/services/users";
import { getDraft, saveDraft, type TripDraft } from "./trips";
import { createBooking, EmptyDraftError } from "./bookings";
import { getBoardingPassData } from "@/lib/boarding-pass-view";
import { OwnershipError } from "./ownership";
import type { FlightOfferView } from "@/lib/offer-view";
import type { HotelOfferView } from "@/lib/hotel-offer-view";

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

function makeHotelOffer(overrides: Partial<HotelOfferView> = {}): HotelOfferView {
  return {
    id: `H-${Math.random().toString(36).slice(2)}`,
    name: "Test Hotel",
    city: "Lisbon",
    country: "PT",
    stars: 4,
    neighborhood: "Old Town",
    amenities: ["Pool"],
    nightlyCents: 10000,
    totalCents: 40000,
    savedCents: 40000,
    nights: 4,
    heroSeed: 555,
    ...overrides,
  };
}

describe("@phase5 createBooking", () => {
  it("5.3 creates trip/flight/booking/stamp rows and increments savings", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-HAPPY-PATH" });
    const draft: TripDraft = { flight };

    const result = await createBooking(user.id, draft);
    expect(result.pnr).toMatch(/^SIM-[A-Z0-9]{6}$/);
    expect(result.emailStatus).toBe("skipped");

    const db = await getDb();
    const trips = await db
      .select()
      .from(schema.trips)
      .where(eq(schema.trips.id, result.tripId));
    expect(trips).toHaveLength(1);
    expect(trips[0].destinationCity).toBe("Lisbon");
    expect(trips[0].destinationCountry).toBe("PT");

    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.tripId, result.tripId));
    expect(bookings).toHaveLength(1);
    expect(bookings[0].type).toBe("flight");
    expect(bookings[0].seat).toMatch(/^\d{1,2}[A-F]$/);
    expect(bookings[0].gate).toMatch(/^[A-F]\d{1,2}$/);
    expect(bookings[0].idempotencyKey).not.toBeNull();

    const stamps = await db
      .select()
      .from(schema.passportStamps)
      .where(eq(schema.passportStamps.tripId, result.tripId));
    expect(stamps).toHaveLength(1);
    expect(stamps[0].countryIso).toBe("PT");
    expect(stamps[0].distanceKm).toBe(flight.distanceKm);

    const updatedUser = await getUser(user.id);
    expect(updatedUser?.totalSavedCents).toBe(flight.savedCents);
  });

  it("5.4 double-confirm is idempotent — exactly one booking", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-DOUBLE-TAP" });
    const draft: TripDraft = { flight };

    const first = await createBooking(user.id, draft);
    const second = await createBooking(user.id, draft);
    expect(second.bookingId).toBe(first.bookingId);
    expect(second.tripId).toBe(first.tripId);

    const db = await getDb();
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.tripId, first.tripId));
    expect(bookings).toHaveLength(1);
  });

  it("race backstop: concurrent double-tap still yields exactly one booking", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-RACE-CONDITION" });
    const draft: TripDraft = { flight };

    const [a, b] = await Promise.all([
      createBooking(user.id, draft),
      createBooking(user.id, draft),
    ]);
    expect(a.bookingId).toBe(b.bookingId);
    expect(a.tripId).toBe(b.tripId);

    const db = await getDb();
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.tripId, a.tripId));
    expect(bookings).toHaveLength(1);
  });

  it("round trip + hotel creates all segment rows and sums savings/distance", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-ROUND-TRIP-OUT" });
    const returnFlight = makeFlightOffer({
      id: "F-ROUND-TRIP-BACK",
      originIata: "LIS",
      originCity: "Lisbon",
      originCountry: "PT",
      originTz: "Europe/Lisbon",
      destIata: "JFK",
      destCity: "New York",
      destCountry: "US",
      destTz: "America/New_York",
      priceCents: 40000,
      savedCents: 40000,
    });
    const hotel = makeHotelOffer();
    const draft: TripDraft = { flight, returnFlight, hotel };

    const result = await createBooking(user.id, draft);
    const db = await getDb();
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.tripId, result.tripId));
    expect(bookings).toHaveLength(3);
    expect(bookings.filter((b) => b.type === "flight")).toHaveLength(2);
    expect(bookings.filter((b) => b.type === "hotel")).toHaveLength(1);

    const stamps = await db
      .select()
      .from(schema.passportStamps)
      .where(eq(schema.passportStamps.tripId, result.tripId));
    expect(stamps[0].distanceKm).toBe(flight.distanceKm + returnFlight.distanceKm);

    const updatedUser = await getUser(user.id);
    expect(updatedUser?.totalSavedCents).toBe(
      flight.savedCents + returnFlight.savedCents + hotel.savedCents,
    );
  });

  it("throws EmptyDraftError with no flight in the draft", async () => {
    const user = await createGuest();
    await expect(createBooking(user.id, {})).rejects.toThrow(EmptyDraftError);
    await expect(createBooking(user.id, null)).rejects.toThrow(EmptyDraftError);
  });

  it("clears the trip draft after a successful booking", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-CLEAR-DRAFT" });
    await saveDraft(user.id, { flight });
    await createBooking(user.id, { flight });
    expect(await getDraft(user.id)).toBeNull();
  });
});

describe("@phase5 getBoardingPassData", () => {
  it("5.9 denies a forged/foreign bookingId without leaking info", async () => {
    const alice = await createGuest();
    const mallory = await createGuest();
    const flight = makeFlightOffer({ id: "F-OWNERSHIP-CHECK" });
    const result = await createBooking(alice.id, { flight });

    await expect(
      getBoardingPassData(mallory.id, result.bookingId),
    ).rejects.toThrow(OwnershipError);
    await expect(
      getBoardingPassData(alice.id, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(OwnershipError);
  });

  it("5.6 returns a QR data URI encoding SIMULATION|{pnr}", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-QR-CODE" });
    const result = await createBooking(user.id, { flight });
    const data = await getBoardingPassData(user.id, result.bookingId);
    expect(data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(data.pnr).toBe(result.pnr);

    // Confirm the payload is a genuine PNG (magic-byte check) rather than
    // trusting the data-URI prefix alone.
    const base64 = data.qrDataUrl.slice("data:image/png;base64,".length);
    const bytes = Buffer.from(base64, "base64");
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("rejects a hotel-type booking id — no pass for hotels", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-HOTEL-GUARD" });
    const hotel = makeHotelOffer();
    const result = await createBooking(user.id, { flight, hotel });

    const db = await getDb();
    const hotelBooking = (
      await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.tripId, result.tripId))
    ).find((booking) => booking.type === "hotel");
    expect(hotelBooking).toBeTruthy();
    await expect(
      getBoardingPassData(user.id, hotelBooking!.id),
    ).rejects.toThrow(OwnershipError);
  });
});
