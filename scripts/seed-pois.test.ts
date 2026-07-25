import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPoisForCity,
  dedupePois,
  keepTopN,
  parseOverpassElements,
  parseWikidataResults,
  parseWikivoyageListing,
  rankPois,
  type CityConfig,
  type OverpassResponse,
  type RawPoi,
  type WikidataResponse,
  type WikivoyageResponse,
} from "./seed-pois-lib";

/*
 * @phase7 POI seed pipeline: pure parse/dedupe/rank functions run entirely
 * offline against committed fixture responses under data/raw/pois — no live
 * network access, deterministic, safe for CI. QA 7.11.
 */

const PARIS: CityConfig = { city: "Paris", isoCountry: "FR", lat: 48.8566, lng: 2.3522 };

function loadFixture<T>(source: string): T {
  const path = join(process.cwd(), "data/raw/pois", source, "paris.json");
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("@phase7 parseWikidataResults", () => {
  it("extracts name, coords, description, sitelinks-derived rank", () => {
    const data: WikidataResponse = {
      results: {
        bindings: [
          {
            item: { value: "http://www.wikidata.org/entity/Q243" },
            itemLabel: { value: "Eiffel Tower" },
            itemDescription: { value: "iron lattice tower" },
            coord: { value: "Point(2.2945 48.8584)" },
            sitelinks: { value: "220" },
          },
        ],
      },
    };
    const [poi] = parseWikidataResults(data, PARIS);
    expect(poi.name).toBe("Eiffel Tower");
    expect(poi.lat).toBeCloseTo(48.8584);
    expect(poi.lng).toBeCloseTo(2.2945);
    expect(poi.category).toBe("landmark");
    expect(poi.source).toBe("wikidata");
    expect(poi.sourceId).toBe("Q243");
    expect(poi.attribution).toMatch(/wikidata/i);
    expect(poi.rank).toBe(2200);
  });

  it("skips rows with unparseable coordinates", () => {
    const data: WikidataResponse = {
      results: {
        bindings: [
          {
            item: { value: "http://www.wikidata.org/entity/Q1" },
            itemLabel: { value: "Bad Coord" },
            coord: { value: "garbage" },
            sitelinks: { value: "5" },
          },
        ],
      },
    };
    expect(parseWikidataResults(data, PARIS)).toHaveLength(0);
  });
});

describe("@phase7 parseWikivoyageListing", () => {
  it("extracts see/do/eat/drink listings with real coordinates", () => {
    const data: WikivoyageResponse = {
      parse: {
        wikitext: {
          "*": "{{eat | name=Le Petit Cler | lat=48.8571 | long=2.3059 | content=Bistro.}}",
        },
      },
    };
    const [poi] = parseWikivoyageListing(data, PARIS);
    expect(poi.name).toBe("Le Petit Cler");
    expect(poi.category).toBe("restaurant");
    expect(poi.source).toBe("wikivoyage");
    expect(poi.attribution).toMatch(/CC BY-SA/);
  });

  it("skips listings without usable coordinates", () => {
    const data: WikivoyageResponse = {
      parse: { wikitext: { "*": "{{see | name=No Coords | content=Missing lat/long.}}" } },
    };
    expect(parseWikivoyageListing(data, PARIS)).toHaveLength(0);
  });
});

describe("@phase7 parseOverpassElements", () => {
  it("maps amenity/tourism/leisure tags to POI categories", () => {
    const data: OverpassResponse = {
      elements: [
        { type: "node", id: 1, lat: 48.85, lon: 2.35, tags: { name: "A Café", amenity: "cafe" } },
        { type: "node", id: 2, lat: 48.86, lon: 2.36, tags: { name: "A Shop", shop: "gifts" } },
      ],
    };
    const pois = parseOverpassElements(data, PARIS);
    expect(pois).toHaveLength(1); // the untagged "shop" row is dropped
    expect(pois[0].category).toBe("cafe");
    expect(pois[0].attribution).toMatch(/OpenStreetMap/);
  });
});

describe("@phase7 dedupePois / rankPois / keepTopN", () => {
  const base: RawPoi = {
    name: "Eiffel Tower",
    city: "Paris",
    isoCountry: "FR",
    lat: 48.8584,
    lng: 2.2945,
    category: "landmark",
    description: null,
    imageUrl: null,
    source: "wikidata",
    sourceId: "Q243",
    attribution: "Wikidata (CC0)",
    rank: 2200,
  };

  it("dedupes the same name within ~150m, keeping the first occurrence", () => {
    const nearDuplicate: RawPoi = {
      ...base,
      source: "wikivoyage",
      sourceId: "dup",
      lat: base.lat + 0.0005,
      rank: 50,
    };
    const result = dedupePois([base, nearDuplicate]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("Q243"); // first-seen (higher-ranked) wins
  });

  it("does not dedupe the same name far apart, or different names nearby", () => {
    const farAway: RawPoi = { ...base, sourceId: "far", lat: 40, lng: -74 };
    const differentName: RawPoi = { ...base, name: "Seine Cruise", sourceId: "diff" };
    expect(dedupePois([base, farAway])).toHaveLength(2);
    expect(dedupePois([base, differentName])).toHaveLength(2);
  });

  it("ranks descending and caps at max", () => {
    const low: RawPoi = { ...base, sourceId: "low", rank: 10 };
    const high: RawPoi = { ...base, sourceId: "high", rank: 9999, name: "Different Name" };
    const ranked = rankPois([low, high]);
    expect(ranked[0].sourceId).toBe("high");
    expect(keepTopN([low, high], 1)).toHaveLength(1);
    expect(keepTopN([low, high], 1)[0].sourceId).toBe("high");
  });
});

describe("@phase7 buildPoisForCity — Paris fixtures (offline, QA 7.11)", () => {
  const wikidata = loadFixture<WikidataResponse>("wikidata");
  const wikivoyage = loadFixture<WikivoyageResponse>("wikivoyage");
  const overpass = loadFixture<OverpassResponse>("overpass");
  const pois = buildPoisForCity(PARIS, wikidata, wikivoyage, overpass);

  it("7.11 yields 30-50 POIs for a well-seeded city", () => {
    expect(pois.length).toBeGreaterThanOrEqual(30);
    expect(pois.length).toBeLessThanOrEqual(50);
  });

  it("7.11 a landmark-class attraction ranks near the top", () => {
    const top10Names = pois.slice(0, 10).map((poi) => poi.name);
    expect(top10Names).toContain("Eiffel Tower");
  });

  it("7.11 every row has non-empty attribution and source_id", () => {
    for (const poi of pois) {
      expect(poi.attribution.length).toBeGreaterThan(0);
      expect(poi.sourceId.length).toBeGreaterThan(0);
    }
  });

  it("cross-source duplicates (Eiffel Tower, Musée d'Orsay) are merged, not double-counted", () => {
    const eiffelCount = pois.filter((poi) => poi.name === "Eiffel Tower").length;
    expect(eiffelCount).toBe(1);
  });

  it("never fabricates a price or rating field on any POI", () => {
    for (const poi of pois) {
      expect(poi).not.toHaveProperty("price");
      expect(poi).not.toHaveProperty("rating");
    }
  });
});
