/*
 * POI pipeline — pure parse/dedupe/rank functions (TECH_SPEC §5.6).
 * Deliberately network-free and side-effect-free so scripts/seed-pois.test.ts
 * can exercise the whole parse→dedupe→rank→keepTopN pipeline offline, in CI,
 * against committed fixture responses. The fetch/caching/DB-write layer
 * that calls these lives in scripts/seed-pois.mts.
 */

import { distanceKm } from "../lib/engine/distance";

export type PoiCategory =
  | "sight"
  | "landmark"
  | "museum"
  | "restaurant"
  | "cafe"
  | "viewpoint"
  | "park";

export interface CityConfig {
  city: string;
  isoCountry: string;
  lat: number;
  lng: number;
}

export interface RawPoi {
  name: string;
  city: string;
  isoCountry: string;
  lat: number;
  lng: number;
  category: PoiCategory;
  description: string | null;
  imageUrl: string | null;
  source: "wikidata" | "wikivoyage" | "osm";
  sourceId: string;
  attribution: string;
  rank: number;
}

/* ── Wikidata (SPARQL JSON results) ─────────────────────────────────────── */

export interface WikidataBinding {
  item: { value: string };
  itemLabel: { value: string };
  itemDescription?: { value: string };
  coord: { value: string }; // "Point(lng lat)"
  sitelinks: { value: string };
}
export interface WikidataResponse {
  results: { bindings: WikidataBinding[] };
}

function parseWktPoint(wkt: string): { lat: number; lng: number } | null {
  const match = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

const LANDMARK_KEYWORDS = /tower|monument|palace|castle|cathedral|temple|bridge|statue|arch\b/i;
const MUSEUM_KEYWORDS = /museum|gallery/i;

function categoryFromName(name: string): PoiCategory {
  if (MUSEUM_KEYWORDS.test(name)) return "museum";
  if (LANDMARK_KEYWORDS.test(name)) return "landmark";
  return "sight";
}

export function parseWikidataResults(
  data: WikidataResponse,
  city: CityConfig,
): RawPoi[] {
  const pois: RawPoi[] = [];
  for (const binding of data.results?.bindings ?? []) {
    const coord = parseWktPoint(binding.coord?.value ?? "");
    const name = binding.itemLabel?.value;
    if (!coord || !name) continue;
    const qid = binding.item.value.split("/").pop() ?? binding.item.value;
    const sitelinks = Number(binding.sitelinks?.value) || 0;
    pois.push({
      name,
      city: city.city,
      isoCountry: city.isoCountry,
      lat: coord.lat,
      lng: coord.lng,
      category: categoryFromName(name),
      description: binding.itemDescription?.value ?? null,
      imageUrl: null,
      source: "wikidata",
      sourceId: qid,
      attribution: "Wikidata (CC0)",
      rank: sitelinks * 10, // sitelink count is the strongest fame proxy available
    });
  }
  return pois;
}

/* ── Wikivoyage (parsed wikitext, "See/Do/Eat/Drink" listing templates) ──── */

export interface WikivoyageResponse {
  parse?: { wikitext?: { "*": string } };
}

const WIKIVOYAGE_CATEGORY: Record<string, PoiCategory> = {
  see: "sight",
  do: "sight",
  eat: "restaurant",
  drink: "cafe",
};

function parseListingParams(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of raw.split("|")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key && value) params[key] = value;
  }
  return params;
}

export function parseWikivoyageListing(
  data: WikivoyageResponse,
  city: CityConfig,
): RawPoi[] {
  const wikitext = data.parse?.wikitext?.["*"] ?? "";
  const pois: RawPoi[] = [];
  const listingRe = /\{\{(see|do|eat|drink)\s*\|([^{}]*)\}\}/gi;
  let match: RegExpExecArray | null;
  while ((match = listingRe.exec(wikitext))) {
    const [, type, rawParams] = match;
    const params = parseListingParams(rawParams);
    const name = params.name ?? params.alt;
    const lat = Number(params.lat);
    const lng = Number(params.long ?? params.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    pois.push({
      name,
      city: city.city,
      isoCountry: city.isoCountry,
      lat,
      lng,
      category: WIKIVOYAGE_CATEGORY[type.toLowerCase()] ?? "sight",
      description: params.content ?? params.description ?? null,
      imageUrl: null,
      source: "wikivoyage",
      sourceId: `${city.city}:${name}`,
      attribution: "Wikivoyage (CC BY-SA)",
      rank: 50, // curated human picks — no fame proxy, so a flat mid-tier rank
    });
  }
  return pois;
}

/* ── OpenStreetMap (Overpass API JSON) ──────────────────────────────────── */

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

function categoryFromTags(tags: Record<string, string>): PoiCategory | null {
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.tourism === "museum") return "museum";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.leisure === "park") return "park";
  if (tags.tourism === "attraction") return "sight";
  return null;
}

export function parseOverpassElements(
  data: OverpassResponse,
  city: CityConfig,
): RawPoi[] {
  const pois: RawPoi[] = [];
  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    const name = tags.name;
    const category = categoryFromTags(tags);
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!name || !category || lat === undefined || lng === undefined) continue;

    // No `pois.address` column — fold a real street address into the
    // description at seed time (Phase 7 plan's zero-migration decision),
    // parsed back out by the itinerary-export renderer.
    const address = [tags["addr:housenumber"], tags["addr:street"]]
      .filter(Boolean)
      .join(" ");

    pois.push({
      name,
      city: city.city,
      isoCountry: city.isoCountry,
      lat,
      lng,
      category,
      description: address || null,
      imageUrl: null,
      source: "osm",
      sourceId: `${element.type}/${element.id}`,
      attribution: "© OpenStreetMap contributors (ODbL)",
      rank: 20, // baseline — below curated/famous sources by default
    });
  }
  return pois;
}

/* ── Dedupe / rank / cap ─────────────────────────────────────────────────── */

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const DUPLICATE_RADIUS_KM = 0.15; // ~150m

/** Same normalized name within ~150m across sources = the same real place. */
export function dedupePois(pois: RawPoi[]): RawPoi[] {
  const kept: RawPoi[] = [];
  for (const poi of pois) {
    const normalized = normalizeName(poi.name);
    const isDuplicate = kept.some(
      (existing) =>
        normalizeName(existing.name) === normalized &&
        distanceKm(existing, poi) < DUPLICATE_RADIUS_KM,
    );
    if (!isDuplicate) kept.push(poi);
  }
  return kept;
}

export function rankPois(pois: RawPoi[]): RawPoi[] {
  return [...pois].sort((a, b) => b.rank - a.rank);
}

export function keepTopN(pois: RawPoi[], max = 50): RawPoi[] {
  return rankPois(pois).slice(0, max);
}

/** The full offline pipeline for one city, given already-fetched raw responses. */
export function buildPoisForCity(
  city: CityConfig,
  rawWikidata: WikidataResponse,
  rawWikivoyage: WikivoyageResponse,
  rawOverpass: OverpassResponse,
  max = 50,
): RawPoi[] {
  const combined = [
    ...parseWikidataResults(rawWikidata, city),
    ...parseWikivoyageListing(rawWikivoyage, city),
    ...parseOverpassElements(rawOverpass, city),
  ];
  return keepTopN(dedupePois(combined), max);
}
