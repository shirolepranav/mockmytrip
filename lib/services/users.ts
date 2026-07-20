import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

/*
 * User services (Phase 2 task 4). All business logic lives here — Server
 * Actions are thin wrappers so a Capacitor build can call these through an
 * external API instead (TECH_SPEC §3).
 */

export type UserRow = typeof schema.users.$inferSelect;

/** Fetch a user by id (null when missing). */
export async function getUser(userId: string): Promise<UserRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Create a fresh guest user row. */
export async function createGuest(): Promise<UserRow> {
  const db = await getDb();
  const rows = await db.insert(schema.users).values({}).returning();
  return rows[0];
}

/** Return the existing user or create a guest (used on first save). */
export async function getOrCreateGuest(
  existingUserId: string | null,
): Promise<UserRow> {
  if (existingUserId) {
    const existing = await getUser(existingUserId);
    if (existing) return existing;
  }
  return createGuest();
}

export async function updatePrefs(
  userId: string,
  prefs: Partial<UserRow["prefsJson"]>,
): Promise<void> {
  const db = await getDb();
  const user = await getUser(userId);
  if (!user) return;
  await db
    .update(schema.users)
    .set({ prefsJson: { ...user.prefsJson, ...prefs } })
    .where(eq(schema.users.id, userId));
}

export async function setDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.users)
    .set({ displayName })
    .where(eq(schema.users.id, userId));
}

/** Full JSON export of everything the user owns (Phase 2 task 6). */
export async function exportData(userId: string) {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user) return null;

  const userTrips = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.userId, userId));
  const userBookings = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.userId, userId));
  const stamps = await db
    .select()
    .from(schema.passportStamps)
    .where(eq(schema.passportStamps.userId, userId));
  const drafts = await db
    .select()
    .from(schema.tripDrafts)
    .where(eq(schema.tripDrafts.userId, userId));

  const tripIds = userTrips.map((trip) => trip.id);
  const itinerary = [] as (typeof schema.itineraryItems.$inferSelect)[];
  const packing = [] as (typeof schema.packingItems.$inferSelect)[];
  for (const tripId of tripIds) {
    itinerary.push(
      ...(await db
        .select()
        .from(schema.itineraryItems)
        .where(eq(schema.itineraryItems.tripId, tripId))),
    );
    packing.push(
      ...(await db
        .select()
        .from(schema.packingItems)
        .where(eq(schema.packingItems.tripId, tripId))),
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    note: "Wanderlost data export. Everything here is from a travel SIMULATION — no real bookings exist.",
    user: { ...user },
    trips: userTrips,
    bookings: userBookings,
    passportStamps: stamps,
    itineraryItems: itinerary,
    packingItems: packing,
    drafts,
  };
}

/** Hard delete: cascades wipe every owned row (Phase 2 task 6). */
export async function deleteAll(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/**
 * Merge a guest's data into an account user (magic-link upgrade), then
 * delete the guest row. Safe when guestId === accountId (no-op).
 */
export async function mergeGuestIntoAccount(
  guestId: string,
  accountId: string,
): Promise<void> {
  if (guestId === accountId) return;
  const db = await getDb();

  await db
    .update(schema.trips)
    .set({ userId: accountId })
    .where(eq(schema.trips.userId, guestId));
  await db
    .update(schema.bookings)
    .set({ userId: accountId })
    .where(eq(schema.bookings.userId, guestId));
  await db
    .update(schema.passportStamps)
    .set({ userId: accountId })
    .where(eq(schema.passportStamps.userId, guestId));
  await db
    .update(schema.pushSubscriptions)
    .set({ userId: accountId })
    .where(eq(schema.pushSubscriptions.userId, guestId));

  // Carry the savings tally over, then remove the guest.
  const guest = await getUser(guestId);
  const account = await getUser(accountId);
  if (guest && account) {
    await db
      .update(schema.users)
      .set({
        totalSavedCents: account.totalSavedCents + guest.totalSavedCents,
      })
      .where(eq(schema.users.id, accountId));
  }
  // Guest draft moves only when the account has none (unique userId).
  const accountDraft = await db
    .select()
    .from(schema.tripDrafts)
    .where(eq(schema.tripDrafts.userId, accountId));
  if (accountDraft.length === 0) {
    await db
      .update(schema.tripDrafts)
      .set({ userId: accountId })
      .where(eq(schema.tripDrafts.userId, guestId));
  }
  await db.delete(schema.users).where(eq(schema.users.id, guestId));
}
