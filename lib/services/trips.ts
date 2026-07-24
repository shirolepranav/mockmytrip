import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { assertOwner } from "./ownership";
import { hashSeed } from "@/lib/engine/seed";

/*
 * Trip services: CRUD + the in-progress trip draft (flight/hotel selection
 * before checkout). Ownership asserted on every mutation.
 */

export type TripRow = typeof schema.trips.$inferSelect;

export type TripStatus = "upcoming" | "in_progress" | "memory";

/** Derive live status from dates (recomputed on read; no cron). */
export function statusOf(
  trip: Pick<TripRow, "startDate" | "endDate">,
  now = new Date(),
): TripStatus {
  if (now < trip.startDate) return "upcoming";
  if (now <= trip.endDate) return "in_progress";
  return "memory";
}

export interface CreateTripInput {
  title: string;
  destinationCity: string;
  destinationCountry?: string;
  startDate: Date;
  endDate: Date;
}

export async function createTrip(
  userId: string,
  input: CreateTripInput,
): Promise<TripRow> {
  const db = await getDb();
  const rows = await db
    .insert(schema.trips)
    .values({
      userId,
      title: input.title,
      destinationCity: input.destinationCity,
      destinationCountry: input.destinationCountry,
      startDate: input.startDate,
      endDate: input.endDate,
      coverSeed: hashSeed(
        `cover:${input.destinationCity}:${input.startDate.toISOString()}`,
      ),
      status: statusOf(input),
    })
    .returning();
  return rows[0];
}

export async function getTrip(
  userId: string,
  tripId: string,
): Promise<TripRow> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.id, tripId))
    .limit(1);
  const trip = rows[0];
  assertOwner(userId, trip);
  return trip;
}

export async function listTrips(userId: string): Promise<TripRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.userId, userId))
    .orderBy(desc(schema.trips.startDate));
}

export async function renameTrip(
  userId: string,
  tripId: string,
  title: string,
): Promise<void> {
  await getTrip(userId, tripId); // ownership check
  const db = await getDb();
  await db
    .update(schema.trips)
    .set({ title })
    .where(eq(schema.trips.id, tripId));
}

/** Delete a trip + bookings (cascade). Stamps persist — they're memories. */
export async function deleteTrip(
  userId: string,
  tripId: string,
): Promise<void> {
  await getTrip(userId, tripId); // ownership check
  const db = await getDb();
  await db.delete(schema.trips).where(eq(schema.trips.id, tripId));
}

export type PassportStampRow = typeof schema.passportStamps.$inferSelect;

/** The passport stamp for a trip, if the caller owns it (Phase 5 write path). */
export async function getStampForTrip(
  userId: string,
  tripId: string,
): Promise<PassportStampRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.passportStamps)
    .where(eq(schema.passportStamps.tripId, tripId))
    .limit(1);
  const stamp = rows[0];
  if (!stamp || stamp.userId !== userId) return null;
  return stamp;
}

/* ── Trip draft (pre-checkout selection) ──────────────────────────────── */

export interface TripDraft {
  flight?: Record<string, unknown>;
  returnFlight?: Record<string, unknown>;
  hotel?: Record<string, unknown>;
  search?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function saveDraft(
  userId: string,
  draft: TripDraft,
): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.tripDrafts)
    .values({ userId, draftJson: draft, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.tripDrafts.userId,
      set: { draftJson: draft, updatedAt: new Date() },
    });
}

export async function getDraft(userId: string): Promise<TripDraft | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.tripDrafts)
    .where(eq(schema.tripDrafts.userId, userId))
    .limit(1);
  return (rows[0]?.draftJson as TripDraft | undefined) ?? null;
}

export async function clearDraft(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.tripDrafts)
    .where(eq(schema.tripDrafts.userId, userId));
}
