import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { type TripRow } from "./trips";
import { OwnershipError } from "./ownership";
import { assertCanEdit, assertCanView } from "./access";

/*
 * Itinerary services (Phase 7 task 1/3; Phase 9 collaborator access):
 * day-by-day items. Reads route through `assertCanView` (owner, editor, or
 * viewer collaborator); mutations route through `assertCanEdit` (owner or
 * editor only — a viewer-role collaborator is denied). `dayIndex` is always
 * clamped to the trip's actual length (QA 7.3) — never trusted from the
 * caller.
 */

export type ItineraryItemRow = typeof schema.itineraryItems.$inferSelect;
export type ItineraryCategory = ItineraryItemRow["category"];

const DAY_MS = 86_400_000;

/** Inclusive day count: a same-day trip is 1 day, a 3-night trip is 4 days, etc. */
export function tripLengthDays(trip: Pick<TripRow, "startDate" | "endDate">): number {
  const spanMs = trip.endDate.getTime() - trip.startDate.getTime();
  return Math.max(1, Math.ceil(spanMs / DAY_MS) + 1);
}

function clampDayIndex(dayIndex: number, trip: Pick<TripRow, "startDate" | "endDate">): number {
  const maxDay = tripLengthDays(trip) - 1;
  return Math.min(Math.max(Math.trunc(dayIndex), 0), maxDay);
}

export async function listItineraryItems(
  userId: string,
  tripId: string,
): Promise<ItineraryItemRow[]> {
  await assertCanView(userId, tripId);
  const db = await getDb();
  return db
    .select()
    .from(schema.itineraryItems)
    .where(eq(schema.itineraryItems.tripId, tripId))
    .orderBy(
      asc(schema.itineraryItems.dayIndex),
      asc(schema.itineraryItems.sortOrder),
    );
}

export interface AddItineraryItemInput {
  dayIndex: number;
  time?: string | null;
  title: string;
  note?: string | null;
  category: ItineraryCategory;
  poiId?: string | null;
}

export async function addItineraryItem(
  userId: string,
  tripId: string,
  input: AddItineraryItemInput,
): Promise<ItineraryItemRow> {
  const { trip } = await assertCanEdit(userId, tripId);
  const dayIndex = clampDayIndex(input.dayIndex, trip);
  const db = await getDb();

  const dayItems = await db
    .select({ sortOrder: schema.itineraryItems.sortOrder })
    .from(schema.itineraryItems)
    .where(
      and(
        eq(schema.itineraryItems.tripId, tripId),
        eq(schema.itineraryItems.dayIndex, dayIndex),
      ),
    );
  const nextSortOrder =
    dayItems.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;

  const [row] = await db
    .insert(schema.itineraryItems)
    .values({
      tripId,
      dayIndex,
      time: input.time ?? null,
      title: input.title,
      note: input.note ?? null,
      category: input.category,
      poiId: input.poiId ?? null,
      sortOrder: nextSortOrder,
      // Attribution (Phase 9, QA 9.6) — an "added by {name}" chip on the
      // owner's board when this was added by a collaborator, not the owner.
      createdByUserId: userId,
    })
    .returning();
  return row;
}

/** Finds an item and asserts the caller can edit its trip; vague on both misses. */
async function getOwnedItem(userId: string, itemId: string): Promise<ItineraryItemRow> {
  const db = await getDb();
  const [item] = await db
    .select()
    .from(schema.itineraryItems)
    .where(eq(schema.itineraryItems.id, itemId))
    .limit(1);
  if (!item) throw new OwnershipError();
  await assertCanEdit(userId, item.tripId);
  return item;
}

export interface UpdateItineraryItemInput {
  time?: string | null;
  title?: string;
  note?: string | null;
  category?: ItineraryCategory;
}

export async function updateItineraryItem(
  userId: string,
  itemId: string,
  patch: UpdateItineraryItemInput,
): Promise<void> {
  await getOwnedItem(userId, itemId);
  const db = await getDb();
  await db
    .update(schema.itineraryItems)
    .set(patch)
    .where(eq(schema.itineraryItems.id, itemId));
}

export async function deleteItineraryItem(userId: string, itemId: string): Promise<void> {
  await getOwnedItem(userId, itemId);
  const db = await getDb();
  await db.delete(schema.itineraryItems).where(eq(schema.itineraryItems.id, itemId));
}

export interface ItineraryMove {
  itemId: string;
  dayIndex: number;
  sortOrder: number;
}

/**
 * Bulk position/day update for one drag gesture's worth of items. Applied as
 * sequential writes (not a transaction) — position integers are low-stakes
 * and self-healing on the next drag; `getBookingDb`'s transaction capability
 * is reserved for booking creation (see lib/db/client.ts).
 */
export async function reorderItineraryItems(
  userId: string,
  tripId: string,
  moves: ItineraryMove[],
): Promise<void> {
  if (moves.length === 0) return;
  const { trip } = await assertCanEdit(userId, tripId);
  const db = await getDb();

  const ids = moves.map((move) => move.itemId);
  const owned = await db
    .select({ id: schema.itineraryItems.id })
    .from(schema.itineraryItems)
    .where(
      and(
        eq(schema.itineraryItems.tripId, tripId),
        inArray(schema.itineraryItems.id, ids),
      ),
    );
  const ownedIds = new Set(owned.map((row) => row.id));

  for (const move of moves) {
    if (!ownedIds.has(move.itemId)) continue; // ignore ids not on this trip
    await db
      .update(schema.itineraryItems)
      .set({
        dayIndex: clampDayIndex(move.dayIndex, trip),
        sortOrder: Math.max(0, Math.trunc(move.sortOrder)),
      })
      .where(eq(schema.itineraryItems.id, move.itemId));
  }
}
