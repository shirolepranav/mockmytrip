import { describe, expect, it } from "vitest";
import { summarizeDraft, generateTripTitle } from "./trip-summary";
import type { TripDraft } from "@/lib/services/trips";
import type { FlightOfferView } from "@/lib/offer-view";
import type { HotelOfferView } from "@/lib/hotel-offer-view";

function makeFlight(overrides: Partial<FlightOfferView> = {}): FlightOfferView {
  return {
    id: "F-TEST1",
    airlineName: "Postcard Air",
    airlineCode: "PT",
    airlineHue: 12,
    airlineLogoSeed: 123456,
    flightNumber: "PT123",
    originIata: "JFK",
    originCity: "New York",
    originCountry: "US",
    originTz: "America/New_York",
    destIata: "LIS",
    destCity: "Lisbon",
    destCountry: "PT",
    destTz: "Europe/Lisbon",
    departUtcMs: Date.UTC(2026, 7, 15, 10, 0),
    arriveUtcMs: Date.UTC(2026, 7, 15, 22, 0),
    durationMin: 480,
    distanceKm: 5400,
    stops: [],
    cabin: "economy",
    passengers: 1,
    priceCents: 45000,
    savedCents: 45000,
    seed: 1,
    ...overrides,
  };
}

function makeHotel(overrides: Partial<HotelOfferView> = {}): HotelOfferView {
  return {
    id: "H-TEST1",
    name: "Hotel Meridian",
    city: "Lisbon",
    country: "PT",
    stars: 4,
    neighborhood: "Old Town",
    amenities: ["Rooftop terrace"],
    nightlyCents: 12000,
    totalCents: 48000,
    savedCents: 48000,
    nights: 4,
    heroSeed: 999,
    ...overrides,
  };
}

describe("summarizeDraft", () => {
  it("empty draft: all false/zero/null", () => {
    const summary = summarizeDraft(null);
    expect(summary.hasFlight).toBe(false);
    expect(summary.hasReturnFlight).toBe(false);
    expect(summary.hasHotel).toBe(false);
    expect(summary.flightTotalCents).toBe(0);
    expect(summary.hotelTotalCents).toBe(0);
    expect(summary.grandTotalCents).toBe(0);
    expect(summary.totalSavedCents).toBe(0);
    expect(summary.nights).toBe(0);
    expect(summary.destinationCity).toBeNull();
    expect(summary.title).toBeNull();
  });

  it("flight-only draft", () => {
    const flight = makeFlight();
    const draft: TripDraft = { flight };
    const summary = summarizeDraft(draft);
    expect(summary.hasFlight).toBe(true);
    expect(summary.hasHotel).toBe(false);
    expect(summary.flightTotalCents).toBe(flight.priceCents);
    expect(summary.grandTotalCents).toBe(flight.priceCents);
    expect(summary.destinationCity).toBe("Lisbon");
    expect(summary.nights).toBe(0);
  });

  it("flight + return + hotel: totals sum correctly", () => {
    const flight = makeFlight({ priceCents: 45000, savedCents: 45000 });
    const returnFlight = makeFlight({
      id: "F-TEST2",
      priceCents: 47000,
      savedCents: 47000,
    });
    const hotel = makeHotel({ totalCents: 48000, savedCents: 48000, nights: 4 });
    const draft: TripDraft = { flight, returnFlight, hotel };
    const summary = summarizeDraft(draft);
    expect(summary.hasFlight).toBe(true);
    expect(summary.hasReturnFlight).toBe(true);
    expect(summary.hasHotel).toBe(true);
    expect(summary.flightTotalCents).toBe(92000);
    expect(summary.hotelTotalCents).toBe(48000);
    expect(summary.grandTotalCents).toBe(140000);
    expect(summary.totalSavedCents).toBe(140000);
    expect(summary.nights).toBe(4);
  });

  it("tolerates a malformed draft.flight without throwing", () => {
    const draft = { flight: { id: "F-BAD" } } as unknown as TripDraft;
    expect(() => summarizeDraft(draft)).not.toThrow();
    const summary = summarizeDraft(draft);
    expect(summary.hasFlight).toBe(false);
    expect(summary.flightTotalCents).toBe(0);
  });

  it("passes through a saved draft title", () => {
    const draft: TripDraft = { flight: makeFlight(), title: "My dream trip" };
    const summary = summarizeDraft(draft);
    expect(summary.title).toBe("My dream trip");
  });
});

describe("generateTripTitle", () => {
  it("singular night", () => {
    expect(generateTripTitle("Lisbon", 1)).toBe("1 day in Lisbon");
  });

  it("plural nights", () => {
    expect(generateTripTitle("Lisbon", 5)).toBe("5 days in Lisbon");
  });

  it("zero nights falls back to a generic trip label", () => {
    expect(generateTripTitle("Lisbon", 0)).toBe("Trip to Lisbon");
  });
});
