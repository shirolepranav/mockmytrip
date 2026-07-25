/*
 * POI seed (Phase 7 task 6, TECH_SPEC §5.6): real sights/restaurants for
 * Explore. Free, build-time-only sources — Wikidata (sitelink-ranked
 * attractions), Wikivoyage (curated See/Do/Eat listings), OSM/Overpass
 * (restaurant/café density). Zero third-party calls at request time; the
 * app only ever reads from the `pois` table.
 *
 * Run: npx tsx scripts/seed-pois.mts [cityName ...]
 * Re-runnable; caches each source's raw response in data/raw/pois/{source}/.
 * DB write is a delete-then-reinsert per city (idempotent, no unique
 * constraint needed — keeps this the only migration-free seed script).
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  buildPoisForCity,
  type CityConfig,
  type OverpassResponse,
  type RawPoi,
  type WikidataResponse,
  type WikivoyageResponse,
} from "./seed-pois-lib";

const ROOT = process.cwd();
const RAW_DIR = join(ROOT, "data/raw/pois");
const POLITE_DELAY_MS = 1100; // one request/second-ish across all three sources

function citySlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cachedFetchJson<T>(cachePath: string, url: string, init?: RequestInit): Promise<T> {
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as T;
  }
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  const data = (await response.json()) as T;
  mkdirSync(join(cachePath, ".."), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data));
  await sleep(POLITE_DELAY_MS);
  return data;
}

function wikidataSparql(city: CityConfig): string {
  return `
    SELECT ?item ?itemLabel ?itemDescription ?coord ?sitelinks WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "12" .
      }
      ?item wdt:P31/wdt:P279* wd:Q570116 .
      ?item wikibase:sitelinks ?sitelinks .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT 60
  `.trim();
}

async function fetchWikidataAttractions(city: CityConfig): Promise<WikidataResponse> {
  const cachePath = join(RAW_DIR, "wikidata", `${citySlug(city.city)}.json`);
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(wikidataSparql(city))}`;
  return cachedFetchJson<WikidataResponse>(cachePath, url, {
    headers: { "User-Agent": "Wanderlost/1.0 (travel simulation app, POI seed script)" },
  });
}

async function fetchWikivoyageListing(city: CityConfig): Promise<WikivoyageResponse> {
  const cachePath = join(RAW_DIR, "wikivoyage", `${citySlug(city.city)}.json`);
  const url = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encodeURIComponent(city.city)}&prop=wikitext&format=json`;
  return cachedFetchJson<WikivoyageResponse>(cachePath, url);
}

function overpassQuery(city: CityConfig): string {
  const { lat, lng } = city;
  return `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](around:4000,${lat},${lng});
      node["amenity"="cafe"](around:4000,${lat},${lng});
      node["tourism"="attraction"](around:6000,${lat},${lng});
      node["tourism"="viewpoint"](around:6000,${lat},${lng});
      node["tourism"="museum"](around:6000,${lat},${lng});
      node["leisure"="park"](around:6000,${lat},${lng});
    );
    out center 80;
  `.trim();
}

async function fetchOverpassPois(city: CityConfig): Promise<OverpassResponse> {
  const cachePath = join(RAW_DIR, "overpass", `${citySlug(city.city)}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as OverpassResponse;
  }
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(overpassQuery(city))}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) throw new Error(`Overpass → ${response.status}`);
  const data = (await response.json()) as OverpassResponse;
  mkdirSync(join(RAW_DIR, "overpass"), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data));
  await sleep(POLITE_DELAY_MS);
  return data;
}

async function writePoisForCity(city: CityConfig, pois: RawPoi[]): Promise<void> {
  const { getDb, schema } = await import("../lib/db/client");
  const db = await getDb();
  await db.delete(schema.pois).where(eq(schema.pois.city, city.city));
  if (pois.length === 0) return;
  await db.insert(schema.pois).values(
    pois.map((poi) => ({
      name: poi.name,
      city: poi.city,
      isoCountry: poi.isoCountry,
      lat: poi.lat,
      lng: poi.lng,
      category: poi.category,
      description: poi.description,
      imageUrl: poi.imageUrl,
      source: poi.source,
      sourceId: poi.sourceId,
      attribution: poi.attribution,
      rank: Math.round(poi.rank),
    })),
  );
}

async function seedCity(city: CityConfig): Promise<number> {
  const [wikidata, wikivoyage, overpass] = await Promise.all([
    fetchWikidataAttractions(city).catch(() => ({ results: { bindings: [] } }) as WikidataResponse),
    fetchWikivoyageListing(city).catch(() => ({}) as WikivoyageResponse),
    fetchOverpassPois(city).catch(() => ({ elements: [] }) as OverpassResponse),
  ]);
  const pois = buildPoisForCity(city, wikidata, wikivoyage, overpass);
  await writePoisForCity(city, pois);
  return pois.length;
}

async function main() {
  const cityFilter = process.argv.slice(2);
  const allCities = JSON.parse(
    readFileSync(join(ROOT, "data/poi-cities.json"), "utf8"),
  ) as CityConfig[];
  const cities = cityFilter.length
    ? allCities.filter((city) => cityFilter.includes(city.city))
    : allCities;

  mkdirSync(RAW_DIR, { recursive: true });

  let total = 0;
  for (const city of cities) {
    const count = await seedCity(city);
    total += count;
    console.log(`  ${city.city}: ${count} POIs`);
  }
  console.log(`Seeded ${total} POIs across ${cities.length} cities.`);
  process.exit(0);
}

await main();
