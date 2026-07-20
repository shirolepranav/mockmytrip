import { getDb, schema } from "@/lib/db/client";
import { airports as airportSeed } from "@/lib/engine/airports";
import { AIRLINES } from "@/lib/engine/names";

/*
 * Idempotent DB seeding: airports (OurAirports) + the curated fictional
 * airline fleet. Used by `npm run db:seed` and the test harness.
 */

export async function seedAirports(): Promise<number> {
  const db = await getDb();
  const existing = await db
    .select({ id: schema.airports.id })
    .from(schema.airports)
    .limit(1);
  if (existing.length > 0) return 0;

  const rows = airportSeed.map((airport) => ({
    ident: airport.ident,
    iataCode: airport.iata,
    icaoCode: airport.icao || null,
    name: airport.name,
    municipality: airport.city,
    isoCountry: airport.country,
    isoRegion: airport.region,
    latitudeDeg: airport.lat,
    longitudeDeg: airport.lng,
    type: airport.type,
    tz: airport.tz,
  }));
  // Chunked inserts keep parameter counts under Postgres limits.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(schema.airports).values(rows.slice(i, i + CHUNK));
  }
  return rows.length;
}

export async function seedAirlines(): Promise<number> {
  const db = await getDb();
  const existing = await db
    .select({ id: schema.airlines.id })
    .from(schema.airlines)
    .limit(1);
  if (existing.length > 0) return 0;

  await db.insert(schema.airlines).values(
    AIRLINES.map((airline) => ({
      name: airline.name,
      code: airline.code,
      hue: airline.hue,
      logoSeed: airline.logoSeed,
    })),
  );
  return AIRLINES.length;
}

export async function seedAll() {
  const airports = await seedAirports();
  const airlines = await seedAirlines();
  return { airports, airlines };
}
