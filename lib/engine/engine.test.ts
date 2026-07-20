import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { byIata } from "./airports";
import { distanceKm } from "./distance";
import { legDurationMin } from "./schedule";
import {
  AIRLINES,
  assertNotRealBrand,
  hotelName,
  RealBrandError,
} from "./names";
import { CABIN_MULTIPLIERS, searchFlights, searchHotels } from "./index";
import { hashSeed, querySeed, seededRandom } from "./seed";
import { utcToZonedParts, zonedToUtcMs } from "./timezone";
import { logoFor } from "./logo";

/*
 * @phase1 regression suite — QA cases 1.1–1.12 from docs/IMPLEMENTATION_PLAN.md.
 * A fixed `now` keeps the booking curve deterministic.
 */

const NOW = Date.UTC(2026, 6, 20); // 2026-07-20
const DEPART = "2026-08-21"; // a Friday, next month

const JFK = byIata("JFK")!;
const LHR = byIata("LHR")!;
const SIN = byIata("SIN")!;
const EWR = byIata("EWR")!;

describe("@phase1 distance", () => {
  it("1.1 JFK→LHR ≈ 5,540 km ± 1%", () => {
    const d = distanceKm(JFK, LHR);
    expect(d).toBeGreaterThan(5540 * 0.99);
    expect(d).toBeLessThan(5540 * 1.01);
  });

  it("1.2 SIN→EWR ≈ 15,300 km ± 1%, no NaN", () => {
    const d = distanceKm(SIN, EWR);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(15300 * 0.99);
    expect(d).toBeLessThan(15300 * 1.01);
  });

  it("guards exact antipodes without NaN", () => {
    const d = distanceKm({ lat: 45, lng: 0 }, { lat: -45, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(19_900);
  });
});

describe("@phase1 schedule", () => {
  it("1.3 JFK→LHR duration 6.5–8h and tz-consistent arrival", () => {
    const offers = searchFlights(
      {
        origin: "JFK",
        destination: "LHR",
        departDate: DEPART,
        passengers: 1,
        cabin: "economy",
      },
      NOW,
    );
    expect(offers.length).toBeGreaterThanOrEqual(3);
    for (const offer of offers.filter((o) => o.stops.length === 0)) {
      expect(offer.durationMin).toBeGreaterThanOrEqual(390);
      expect(offer.durationMin).toBeLessThanOrEqual(480);
      // Arrival = departure + duration exactly (UTC ms domain).
      expect(offer.arriveUtcMs - offer.departUtcMs).toBe(
        offer.durationMin * 60_000,
      );
      // Local arrival formats to a valid London wall time (tz applies).
      const local = utcToZonedParts(offer.arriveUtcMs, offer.destination.tz);
      expect(local.hour).toBeGreaterThanOrEqual(0);
      expect(local.hour).toBeLessThan(24);
    }
  });

  it("1.4 short hop (< 400 km) uses turboprop profile and flies direct", () => {
    // AMS→BRU ≈ 155 km
    const AMS = byIata("AMS")!;
    const BRU = byIata("BRU")!;
    const d = distanceKm(AMS, BRU);
    expect(d).toBeLessThan(400);
    const duration = legDurationMin(d);
    // Turboprop 550 km/h + 30 min overhead, snapped to 5.
    const expected = Math.round(((d / 550) * 60 + 30) / 5) * 5;
    expect(duration).toBe(expected);

    const offers = searchFlights(
      { origin: "AMS", destination: "BRU", departDate: DEPART, passengers: 1, cabin: "economy" },
      NOW,
    );
    for (const offer of offers) expect(offer.stops).toEqual([]);
  });

  it("1.5 ultra-long (> 10,000 km) has 0–1 stops with 60–120 min layovers", () => {
    const offers = searchFlights(
      { origin: "AKL", destination: "BOS", departDate: DEPART, passengers: 1, cabin: "economy" },
      NOW,
    );
    for (const offer of offers) {
      expect(offer.stops.length).toBeLessThanOrEqual(1);
      for (const stop of offer.stops) {
        expect(stop.layoverMin).toBeGreaterThanOrEqual(60);
        expect(stop.layoverMin).toBeLessThanOrEqual(120);
      }
    }
    // A non-hub ultra-long market should produce at least one 1-stop routing.
    expect(offers.some((offer) => offer.stops.length === 1)).toBe(true);
  });

  it("departures land inside the 06–09/11–14/17–21 local banks", () => {
    const offers = searchFlights(
      { origin: "JFK", destination: "LHR", departDate: DEPART, passengers: 1, cabin: "economy" },
      NOW,
    );
    for (const offer of offers) {
      const local = utcToZonedParts(offer.departUtcMs, offer.origin.tz);
      const inBank =
        (local.hour >= 6 && local.hour < 9) ||
        (local.hour >= 11 && local.hour < 14) ||
        (local.hour >= 17 && local.hour < 21);
      expect(inBank, `hour ${local.hour}`).toBe(true);
      // Departs on the requested local date.
      expect(local.year).toBe(2026);
      expect(local.month).toBe(8);
      expect(local.day).toBe(21);
    }
  });

  it("flight numbers look like CODE + 2–4 digits", () => {
    const offers = searchFlights(
      { origin: "JFK", destination: "LHR", departDate: DEPART, passengers: 1, cabin: "economy" },
      NOW,
    );
    for (const offer of offers) {
      expect(offer.flightNumber).toMatch(
        new RegExp(`^${offer.airline.code}\\d{2,4}$`),
      );
    }
  });
});

describe("@phase1 pricing", () => {
  const query = (
    origin: string,
    destination: string,
    cabin: "economy" | "premium" | "business" | "first" = "economy",
  ) =>
    searchFlights(
      { origin, destination, departDate: DEPART, passengers: 1, cabin },
      NOW,
    );

  it("1.6 longer route is not dramatically cheaper (band-aware sanity)", () => {
    const short = query("AMS", "BRU"); // ~155 km
    const medium = query("JFK", "LHR"); // ~5,540 km
    const long = query("SIN", "EWR"); // ~15,300 km
    const avg = (offers: ReturnType<typeof query>) =>
      offers.reduce((sum, o) => sum + o.priceCents, 0) / offers.length;
    expect(avg(medium)).toBeGreaterThanOrEqual(avg(short) * 0.9);
    expect(avg(long)).toBeGreaterThanOrEqual(avg(medium) * 0.9);
  });

  it("1.7 every route floors at $39 economy", () => {
    for (const offer of query("AMS", "BRU")) {
      expect(offer.priceCents).toBeGreaterThanOrEqual(39_00);
    }
  });

  it("1.8 business ≈ 3.2× economy within jitter bounds", () => {
    const economy = query("JFK", "LHR", "economy");
    const business = query("JFK", "LHR", "business");
    for (let i = 0; i < economy.length; i++) {
      const ratio = business[i].priceCents / economy[i].priceCents;
      // Same flight, same jitter — the ratio is exactly the multiplier
      // modulo rounding.
      expect(ratio).toBeGreaterThan(3.2 * 0.99);
      expect(ratio).toBeLessThan(3.2 * 1.01);
    }
    expect(CABIN_MULTIPLIERS.business / CABIN_MULTIPLIERS.economy).toBe(3.2);
  });

  it("passenger count multiplies the total", () => {
    const solo = query("JFK", "LHR");
    const four = searchFlights(
      { origin: "JFK", destination: "LHR", departDate: DEPART, passengers: 4, cabin: "economy" },
      NOW,
    );
    expect(four[0].priceCents).toBe(solo[0].priceCents * 4);
  });
});

describe("@phase1 determinism", () => {
  it("1.9 identical query ⇒ deep-equal results; different date ⇒ different jitter", () => {
    const q = {
      origin: "JFK",
      destination: "LHR",
      departDate: DEPART,
      passengers: 1,
      cabin: "economy" as const,
    };
    expect(searchFlights(q, NOW)).toEqual(searchFlights(q, NOW));

    const other = searchFlights({ ...q, departDate: "2026-09-22" }, NOW);
    const first = searchFlights(q, NOW);
    expect(other.map((o) => o.priceCents)).not.toEqual(
      first.map((o) => o.priceCents),
    );
  });

  it("PRNG stream is stable for a given seed", () => {
    const a = seededRandom(hashSeed("wanderlost"));
    const b = seededRandom(hashSeed("wanderlost"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("@phase1 brand blocklist", () => {
  it("1.10 airline fleet and 10,000 hotel names contain zero real brands", () => {
    for (const airline of AIRLINES) {
      expect(() => assertNotRealBrand(airline.name)).not.toThrow();
    }
    for (let city = 0; city < 500; city++) {
      for (let index = 0; index < 20; index++) {
        const name = hotelName(`city-${city}`, index);
        expect(() => assertNotRealBrand(name)).not.toThrow();
      }
    }
  });

  it('1.10b planted "Delta Hotel" style names throw', () => {
    expect(() => assertNotRealBrand("Delta Hotel")).toThrow(RealBrandError);
    expect(() => assertNotRealBrand("The Hilton Garden")).toThrow(
      RealBrandError,
    );
    expect(() => assertNotRealBrand("Marriott House")).toThrow(RealBrandError);
  });
});

describe("@phase1 airports seed", () => {
  it("1.11 slim JSON < 300 KB gzip with key airports + tz present", () => {
    const slim = readFileSync(
      join(process.cwd(), "public/data/airports.slim.json"),
      "utf8",
    );
    expect(gzipSync(Buffer.from(slim)).length).toBeLessThan(300 * 1024);
    const rows = JSON.parse(slim) as [string, string, string, string, number, number, string][];
    for (const iata of ["JFK", "LHR", "HND", "PPT"]) {
      const row = rows.find((r) => r[0] === iata);
      expect(row, iata).toBeDefined();
      expect(row![6]).toMatch(/\//); // IANA tz like America/New_York
    }
  });

  it("timezone conversion round-trips a NY summer wall time", () => {
    const utc = zonedToUtcMs(2026, 8, 21, 7, 30, "America/New_York");
    // EDT = UTC-4 in August.
    expect(new Date(utc).toISOString()).toBe("2026-08-21T11:30:00.000Z");
  });
});

describe("@phase1 hotels", () => {
  const q = {
    city: "Lisbon",
    country: "PT",
    checkin: "2026-08-21",
    checkout: "2026-08-26",
    guests: 2,
    rooms: 1,
  };

  it("1.12 8–20 hotels, stars 3–5, deterministic", () => {
    const offers = searchHotels(q);
    expect(offers.length).toBeGreaterThanOrEqual(8);
    expect(offers.length).toBeLessThanOrEqual(20);
    for (const offer of offers) {
      expect([3, 4, 5]).toContain(offer.stars);
      expect(offer.nights).toBe(5);
      expect(offer.totalCents).toBe(offer.nightlyCents * 5);
      expect(offer.savedCents).toBe(offer.totalCents);
    }
    expect(searchHotels(q)).toEqual(offers);
  });

  it("rejects checkout ≤ checkin", () => {
    expect(() =>
      searchHotels({ ...q, checkout: "2026-08-21" }),
    ).toThrow();
  });
});

describe("@phase1 logos", () => {
  it("logoFor is deterministic and emits valid SVG across all styles", () => {
    for (let seed = 1; seed <= 16; seed++) {
      const mark = logoFor(seed * 7919, { hue: (seed * 37) % 360 });
      expect(mark).toBe(logoFor(seed * 7919, { hue: (seed * 37) % 360 }));
      expect(mark).toMatch(/^<svg /);
      expect(mark).toContain("</svg>");
    }
  });

  it("every airline in the fleet renders a mark", () => {
    for (const airline of AIRLINES) {
      expect(logoFor(airline.logoSeed, { hue: airline.hue })).toContain(
        "<svg",
      );
    }
  });
});

describe("@phase1 querySeed", () => {
  it("is order-insensitive and case/whitespace-normalizing", () => {
    expect(querySeed({ a: "JFK ", b: "lhr" })).toBe(
      querySeed({ b: "LHR", a: "jfk" }),
    );
    expect(querySeed({ a: "JFK" })).not.toBe(querySeed({ a: "LHR" }));
  });
});
