"use client";

/*
 * Client-side airport index for the autocomplete: lazily fetches the slim
 * JSON (98 KB gzip), caches it module-wide, and offers a simple ranked
 * fuzzy match over IATA / city / airport name.
 */

export interface SlimAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  tz: string;
}

type SlimRow = [string, string, string, string, number, number, string];

let cache: SlimAirport[] | null = null;
let inflight: Promise<SlimAirport[]> | null = null;

export async function loadAirports(): Promise<SlimAirport[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/data/airports.slim.json")
      .then((response) => response.json() as Promise<SlimRow[]>)
      .then((rows) => {
        cache = rows.map(([iata, name, city, country, lat, lng, tz]) => ({
          iata,
          name,
          city,
          country,
          lat,
          lng,
          tz,
        }));
        return cache;
      });
  }
  return inflight;
}

/** Ranked match: IATA exact > city prefix > name prefix > substring. */
export function searchAirports(
  airports: SlimAirport[],
  rawQuery: string,
  limit = 8,
): SlimAirport[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const scored: { airport: SlimAirport; score: number }[] = [];
  for (const airport of airports) {
    const iata = airport.iata.toLowerCase();
    const city = airport.city.toLowerCase();
    const name = airport.name.toLowerCase();
    let score = 0;
    if (iata === query) score = 100;
    else if (city.startsWith(query)) score = 80;
    else if (name.startsWith(query)) score = 70;
    else if (city.includes(query)) score = 55;
    else if (name.includes(query)) score = 45;
    else if (iata.startsWith(query)) score = 40;
    if (score > 0) scored.push({ airport, score });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.airport.city.localeCompare(b.airport.city),
    )
    .slice(0, limit)
    .map((entry) => entry.airport);
}
