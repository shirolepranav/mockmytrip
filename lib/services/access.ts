import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { OwnershipError } from "./ownership";
import type { TripRow } from "./trips";

/*
 * Collaboration-aware access resolution (Phase 9, TECH_SPEC §8b.1). Parallel
 * to lib/services/ownership.ts's assertOwner — deliberately does NOT change
 * trips.ts's getTrip/assertOwner, which stay owner-only on purpose. Every
 * mutation outside itinerary_items (bookings, passport, packing, AI, trip
 * delete/rename) must keep using getTrip/assertOwner so a collaborator never
 * gains access beyond golden rule #10 ("collaborators edit ONLY
 * itinerary_items").
 */

export type AccessRole = "owner" | "editor" | "viewer";

export interface TripAccess {
  role: AccessRole;
  trip: TripRow;
}

/** Resolve the caller's role on a trip: owner, collaborator, or denied. */
export async function resolveAccess(
  userId: string,
  tripId: string,
): Promise<TripAccess> {
  const db = await getDb();
  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.id, tripId))
    .limit(1);
  if (!trip) throw new OwnershipError();
  if (trip.userId === userId) return { role: "owner", trip };

  const [collaborator] = await db
    .select({ role: schema.tripCollaborators.role })
    .from(schema.tripCollaborators)
    .where(
      and(
        eq(schema.tripCollaborators.tripId, tripId),
        eq(schema.tripCollaborators.userId, userId),
      ),
    )
    .limit(1);
  if (collaborator) return { role: collaborator.role, trip };

  throw new OwnershipError(); // same vague error as assertOwner — no existence leak
}

/** Owner, editor, or viewer may view — read-only access checks route through this. */
export async function assertCanView(
  userId: string,
  tripId: string,
): Promise<TripAccess> {
  return resolveAccess(userId, tripId);
}

/** Owner or editor may mutate itinerary_items; a viewer is denied. */
export async function assertCanEdit(
  userId: string,
  tripId: string,
): Promise<TripAccess> {
  const access = await resolveAccess(userId, tripId);
  if (access.role === "viewer") throw new OwnershipError();
  return access;
}
