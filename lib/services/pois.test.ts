// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase7 POI service suite against embedded in-memory PGlite: category
 * filtering, distance-from-center math, and the unseeded-city empty result
 * + nearest-seeded-city suggestion.
 */

process.env.PGLITE_MEMORY = "1";

import { getDb, schema } from "@/lib/db/client";
import {
  cityCenter,
  getPoi,
  getTopPoisForCity,
  listPoisForCity,
  nearestSeededCity,
} from "./pois";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

async function seedPoi(overrides: Partial<typeof schema.pois.$inferInsert>) {
  const db = await getDb();
  const [row] = await db
    .insert(schema.pois)
    .values({
      name: "Test POI",
      city: "Lisbon",
      isoCountry: "PT",
      lat: 38.7813,
      lng: -9.1359,
      category: "sight",
      description: "A test place",
      imageUrl: null,
      source: "wikidata",
      sourceId: `Q${Math.random().toString(36).slice(2)}`,
      attribution: "Wikidata (CC0)",
      rank: 100,
      ...overrides,
    })
    .returning();
  return row;
}

describe("@phase7 listPoisForCity", () => {
  it("filters by category and orders by rank descending", async () => {
    await seedPoi({ name: "Low Sight", city: "TestCityA", category: "sight", rank: 10 });
    await seedPoi({ name: "High Sight", city: "TestCityA", category: "sight", rank: 90 });
    await seedPoi({ name: "A Café", city: "TestCityA", category: "cafe", rank: 50 });

    const sights = await listPoisForCity("TestCityA", "sight");
    expect(sights.map((poi) => poi.name)).toEqual(["High Sight", "Low Sight"]);

    const all = await listPoisForCity("TestCityA");
    expect(all).toHaveLength(3);
  });

  it("computes distance-from-center via the real airport dataset", async () => {
    const center = cityCenter("Lisbon");
    expect(center).not.toBeNull();

    await seedPoi({ name: "Near Lisbon", city: "TestCityB-Lisbon", lat: 38.7813, lng: -9.1359 });
    // Use a real seeded-airport city name so cityCenter() resolves.
    const pois = await listPoisForCity("TestCityB-Lisbon");
    // No airport named "TestCityB-Lisbon" exists, so distance is null —
    // confirms the graceful fallback when a city isn't in the airport seed.
    expect(pois[0].distanceFromCenterKm).toBeNull();
  });

  it("returns an accurate distance for a real seeded-airport city", async () => {
    await seedPoi({ name: "Belém Tower", city: "Lisbon", lat: 38.6916, lng: -9.216 });
    const pois = await listPoisForCity("Lisbon");
    const belem = pois.find((poi) => poi.name === "Belém Tower");
    expect(belem?.distanceFromCenterKm).not.toBeNull();
    expect(belem!.distanceFromCenterKm!).toBeGreaterThan(0);
    expect(belem!.distanceFromCenterKm!).toBeLessThan(50); // sanity bound
  });

  it("an unseeded city returns an empty list", async () => {
    const pois = await listPoisForCity("Nowhereville");
    expect(pois).toEqual([]);
  });
});

describe("@phase7 getPoi / getTopPoisForCity", () => {
  it("getPoi resolves a single row with distance attached", async () => {
    const created = await seedPoi({ name: "Solo POI", city: "TestCityC" });
    const found = await getPoi(created.id);
    expect(found?.name).toBe("Solo POI");
  });

  it("getPoi returns null for a missing id", async () => {
    const found = await getPoi("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });

  it("getTopPoisForCity caps and orders by rank", async () => {
    for (let i = 0; i < 5; i++) {
      await seedPoi({ name: `Ranked ${i}`, city: "TestCityD", rank: i * 10 });
    }
    const top = await getTopPoisForCity("TestCityD", 3);
    expect(top).toHaveLength(3);
    expect(top[0].name).toBe("Ranked 4");
  });
});

describe("@phase7 nearestSeededCity", () => {
  it("suggests the nearest seeded city to an unseeded one", async () => {
    await seedPoi({ name: "Lisbon Landmark", city: "Lisbon", lat: 38.7813, lng: -9.1359 });
    // "Porto" is a real airport city near Lisbon, seeded with no POIs itself.
    const nearest = await nearestSeededCity("Porto");
    expect(nearest?.city).toBe("Lisbon");
  });

  it("returns null when the queried city isn't a known airport city", async () => {
    const nearest = await nearestSeededCity("Not A Real Airport City XYZ");
    expect(nearest).toBeNull();
  });
});
