import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { hashSeed, randInt, seededRandom } from "@/lib/engine/seed";
import { byIata } from "@/lib/engine/airports";
import { distanceKm as haversineKm } from "@/lib/engine/distance";
import { generateGate, generatePnr, generateSeat } from "./bookings";
import { statusOf } from "./trips";

/*
 * Dev/test-only trip seeding (Phase 6): the real search->checkout flow can
 * never produce a past or in-progress trip (the date picker floors at
 * today), so e2e coverage of dashboard grouping, the past-dated guard, and
 * departure-day states needs a way to insert a trip at an exact date. This
 * inserts rows shaped exactly like lib/services/bookings.ts's
 * runBookingTransaction (same seeded-randomness pattern for stamp
 * cosmetics) so seeded data is indistinguishable from a real booking in
 * assertions. NEVER call this from a user-facing code path — the only
 * caller is the gated route at app/api/test/seed-trip/route.ts.
 */

export interface SeedTripInput {
  title?: string;
  originIata?: string;
  destIata?: string;
  departAt: Date;
  arriveAt: Date;
  endDate: Date;
  distanceKm?: number;
  savedCents?: number;
  withStamp?: boolean;
}

export interface SeedTripResult {
  tripId: string;
  bookingId: string;
}

export async function seedTestTrip(
  userId: string,
  input: SeedTripInput,
): Promise<SeedTripResult> {
  const originIata = input.originIata ?? "JFK";
  const destIata = input.destIata ?? "LIS";
  const origin = byIata(originIata);
  const destination = byIata(destIata);
  if (!origin || !destination) {
    throw new Error(`Unknown airport: ${!origin ? originIata : destIata}`);
  }

  const db = await getDb();
  const seed = hashSeed(`test-seed:${userId}:${input.departAt.toISOString()}`);
  const rand = seededRandom(seed);
  const km = input.distanceKm ?? Math.round(haversineKm(origin, destination));

  const [flightRow] = await db
    .insert(schema.flights)
    .values({
      airlineName: "Testbird Airways",
      airlineCode: "TB",
      airlineHue: randInt(rand, 0, 359),
      airlineLogoSeed: seed,
      flightNumber: `TB${randInt(rand, 100, 999)}`,
      originIata,
      destIata,
      departAt: input.departAt,
      arriveAt: input.arriveAt,
      durationMin: Math.max(
        1,
        Math.round((input.arriveAt.getTime() - input.departAt.getTime()) / 60_000),
      ),
      distanceKm: km,
      cabin: "economy",
      stops: [],
      priceCents: 0,
      seed,
    })
    .returning();

  const title = input.title ?? `Trip to ${destination.city}`;
  const [tripRow] = await db
    .insert(schema.trips)
    .values({
      userId,
      title,
      destinationCity: destination.city,
      destinationCountry: destination.country,
      coverSeed: hashSeed(
        `cover:${destination.city}:${input.departAt.toISOString()}`,
      ),
      startDate: input.departAt,
      endDate: input.endDate,
      status: statusOf({ startDate: input.departAt, endDate: input.endDate }),
    })
    .returning();

  const savedCents = input.savedCents ?? 4000;
  const [bookingRow] = await db
    .insert(schema.bookings)
    .values({
      tripId: tripRow.id,
      userId,
      type: "flight",
      flightId: flightRow.id,
      pnr: generatePnr(),
      seat: generateSeat(),
      gate: generateGate(),
      priceCents: 0,
      savedCents,
      idempotencyKey: null,
    })
    .returning();

  if (input.withStamp ?? true) {
    // Same seeded-randomness pattern bookings.ts uses, so a seeded stamp is
    // deterministic and visually indistinguishable from a real one.
    const stampRand = seededRandom(hashSeed(`stamp:${tripRow.id}`));
    await db.insert(schema.passportStamps).values({
      userId,
      tripId: tripRow.id,
      countryIso: destination.country,
      city: destination.city,
      stampStyle: randInt(stampRand, 0, 5),
      stampDate: input.departAt,
      rotationDeg: randInt(stampRand, -18, 18),
      inkHue: randInt(stampRand, 0, 359),
      distanceKm: km,
    });
  }

  await db
    .update(schema.users)
    .set({ totalSavedCents: sql`${schema.users.totalSavedCents} + ${savedCents}` })
    .where(eq(schema.users.id, userId));

  return { tripId: tripRow.id, bookingId: bookingRow.id };
}
