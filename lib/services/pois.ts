import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { airports } from "@/lib/engine/airports";
import { distanceKm } from "@/lib/engine/distance";

/*
 * POI services (Phase 7 task 7): read-only access to the seeded `pois`
 * table (real places — never fake prices/ratings). Distance-from-city-
 * center is derived at read time via the same airport dataset flight
 * search uses, never stored.
 */

export type PoiRow = typeof schema.pois.$inferSelect;
export type PoiCategory = PoiRow["category"];

export interface PoiWithDistance extends PoiRow {
  distanceFromCenterKm: number | null;
}

/** Approximate city-center coordinates via the airport seed. */
export function cityCenter(city: string): { lat: number; lng: number } | null {
  const lower = city.toLowerCase();
  const large = airports.find(
    (airport) => airport.city.toLowerCase() === lower && airport.type === "large_airport",
  );
  const any = large ?? airports.find((airport) => airport.city.toLowerCase() === lower);
  return any ? { lat: any.lat, lng: any.lng } : null;
}

function withDistance(rows: PoiRow[], city: string): PoiWithDistance[] {
  const center = cityCenter(city);
  return rows.map((row) => ({
    ...row,
    distanceFromCenterKm: center ? distanceKm(center, { lat: row.lat, lng: row.lng }) : null,
  }));
}

export async function listPoisForCity(
  city: string,
  category?: PoiCategory,
): Promise<PoiWithDistance[]> {
  const db = await getDb();
  const condition = category
    ? and(eq(schema.pois.city, city), eq(schema.pois.category, category))
    : eq(schema.pois.city, city);
  const rows = await db
    .select()
    .from(schema.pois)
    .where(condition)
    .orderBy(desc(schema.pois.rank));
  return withDistance(rows, city);
}

export async function getPoi(poiId: string): Promise<PoiWithDistance | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.pois).where(eq(schema.pois.id, poiId)).limit(1);
  if (!row) return null;
  return withDistance([row], row.city)[0];
}

/** Top-ranked POIs for a city, capped — grounds the AI itinerary prompt. */
export async function getTopPoisForCity(city: string, limit = 15): Promise<PoiRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.pois)
    .where(eq(schema.pois.city, city))
    .orderBy(desc(schema.pois.rank))
    .limit(limit);
}

/** The nearest seeded city to `city` (itself possibly unseeded), by center distance. */
export async function nearestSeededCity(
  city: string,
): Promise<{ city: string; isoCountry: string } | null> {
  const center = cityCenter(city);
  if (!center) return null;

  const db = await getDb();
  const rows = await db
    .selectDistinct({ city: schema.pois.city, isoCountry: schema.pois.isoCountry })
    .from(schema.pois);

  let best: { city: string; isoCountry: string } | null = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    if (row.city.toLowerCase() === city.toLowerCase()) continue;
    const rowCenter = cityCenter(row.city);
    if (!rowCenter) continue;
    const distance = distanceKm(center, rowCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }
  return best;
}
