// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase7 packing service suite against embedded in-memory PGlite:
 * climate-band math, auto-generation contrast (QA 7.7), and reset-preserves-
 * custom-items behavior.
 */

process.env.PGLITE_MEMORY = "1";

import { getDb } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createBooking } from "@/lib/services/bookings";
import type { TripDraft } from "@/lib/services/trips";
import type { FlightOfferView } from "@/lib/offer-view";
import {
  addCustomItem,
  climateBandFor,
  generateStarterPackingList,
  listPackingItems,
  resetToAuto,
} from "./packing";

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
    departUtcMs: Date.parse("2026-01-15T10:00:00Z"),
    arriveUtcMs: Date.parse("2026-01-15T20:00:00Z"),
    durationMin: 480,
    distanceKm: 5400,
    stops: [],
    cabin: "economy",
    passengers: 1,
    priceCents: 45000,
    savedCents: 100,
    seed: 999,
    ...overrides,
  };
}

describe("@phase7 climateBandFor", () => {
  it("7.7 tropical stays hot regardless of month", () => {
    expect(climateBandFor(13.7, 1)).toBe("hot"); // Bangkok, January
    expect(climateBandFor(13.7, 7)).toBe("hot"); // Bangkok, July
  });

  it("7.7 far-north latitude in January is cold", () => {
    expect(climateBandFor(64.1, 1)).toBe("cold"); // Reykjavik, January
  });

  it("is hemisphere-aware: southern-hemisphere January is warm-leaning", () => {
    expect(climateBandFor(-34.6, 1)).toBe("hot"); // Buenos Aires, January (southern summer)
    expect(climateBandFor(-34.6, 7)).toBe("cold"); // Buenos Aires, July (southern winter)
  });
});

describe("@phase7 generateStarterPackingList", () => {
  it("7.7 Reykjavik-in-January and Bangkok-in-July differ sensibly", async () => {
    const userReykjavik = await createGuest();
    // JFK->REK isn't in the fixture list; use the flight's dest lat via a
    // custom offer landing near Reykjavik's latitude by overriding destIata
    // to an airport actually near that band. LIS (~38.7N) is temperate, so
    // pick a booking whose real destination airport is far north instead.
    const coldFlight = makeFlightOffer({
      id: "F-COLD",
      destIata: "KEF", // Reykjavik-Keflavik, ~64N
      destCity: "Reykjavik",
      destCountry: "IS",
      departUtcMs: Date.parse("2026-01-15T10:00:00Z"),
      arriveUtcMs: Date.parse("2026-01-15T14:00:00Z"),
    });
    const draftCold: TripDraft = { flight: coldFlight };
    const coldResult = await createBooking(userReykjavik.id, draftCold);
    const coldItems = await generateStarterPackingList(userReykjavik.id, coldResult.tripId);
    const coldLabels = coldItems.map((item) => item.label).join(" | ");

    const userBangkok = await createGuest();
    const hotFlight = makeFlightOffer({
      id: "F-HOT",
      destIata: "BKK",
      destCity: "Bangkok",
      destCountry: "TH",
      departUtcMs: Date.parse("2026-07-15T10:00:00Z"),
      arriveUtcMs: Date.parse("2026-07-15T14:00:00Z"),
    });
    const draftHot: TripDraft = { flight: hotFlight };
    const hotResult = await createBooking(userBangkok.id, draftHot);
    const hotItems = await generateStarterPackingList(userBangkok.id, hotResult.tripId);
    const hotLabels = hotItems.map((item) => item.label).join(" | ");

    expect(coldLabels).toMatch(/coat|thermal|sweater|gloves|beanie|scarf/i);
    expect(hotLabels).toMatch(/t-shirt|shorts|sunhat|swimsuit|sandals/i);
    expect(coldLabels).not.toEqual(hotLabels);

    // Every generated row is auto-flagged and category-bucketed.
    expect(coldItems.every((item) => item.isAuto)).toBe(true);
    const categories = new Set(coldItems.map((item) => item.category));
    expect(categories).toEqual(new Set(["clothing", "docs", "tech", "toiletries"]));
  });

  it("list length scales with trip length via the quantity items", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-LONG-TRIP" });
    const result = await createBooking(user.id, { flight });
    const items = await generateStarterPackingList(user.id, result.tripId);
    const underwear = items.find((item) => item.label.includes("underwear"));
    // Same-day depart/arrive still spans 2 inclusive days per tripLengthDays.
    expect(underwear?.label).toBe("2× underwear");
  });
});

describe("@phase7 resetToAuto", () => {
  it("preserves custom items while regenerating the auto ones", async () => {
    const user = await createGuest();
    const flight = makeFlightOffer({ id: "F-RESET" });
    const result = await createBooking(user.id, { flight });

    await generateStarterPackingList(user.id, result.tripId);
    const custom = await addCustomItem(user.id, result.tripId, "Lucky travel hat", "misc");

    const afterReset = await resetToAuto(user.id, result.tripId);
    expect(afterReset.every((item) => item.isAuto)).toBe(true);

    const all = await listPackingItems(user.id, result.tripId);
    expect(all.some((item) => item.id === custom.id)).toBe(true);
    expect(all.filter((item) => !item.isAuto)).toHaveLength(1);
  });
});
