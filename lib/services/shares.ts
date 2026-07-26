import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { OwnershipError } from "./ownership";
import { getTrip, statusOf, type TripRow } from "./trips";
import type { ItineraryItemRow } from "./itinerary";
import { assertCanView } from "./access";

/*
 * Sharing & collaboration services (Phase 9, TECH_SPEC §8b). Deliberately
 * free of `next/cache` imports — revalidateTag/revalidatePath calls belong
 * in actions/shares.ts, matching the existing actions/itinerary.ts split,
 * and keeping this file plain-Vitest testable with no request context.
 */

export type TripShareRow = typeof schema.tripShares.$inferSelect;
export type TripCollaboratorRow = typeof schema.tripCollaborators.$inferSelect;
export type SharePermission = TripShareRow["permission"];
export type CollaboratorRole = TripCollaboratorRow["role"];

export class ShareRateLimitError extends Error {
  constructor() {
    super("You've shared a lot today — try again tomorrow");
    this.name = "ShareRateLimitError";
  }
}

/** Revoked, expired, or the trip itself is gone — collapsed to one state (WF §20c). */
export class ShareGoneError extends Error {
  constructor() {
    super("This dream has been tucked away");
    this.name = "ShareGoneError";
  }
}

export class ShareNotEditableError extends Error {
  constructor() {
    super("This link is view-only");
    this.name = "ShareNotEditableError";
  }
}

const SHARE_RATE_LIMIT_PER_DAY = 10;
const TOKEN_LENGTH = 22;
const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * 22-char base62 token via rejection sampling over CSPRNG bytes. 256 % 62 =
 * 8, so bytes >= 248 are re-rolled to avoid modulo bias. ~131 bits of
 * entropy — not derived from tripId, unguessable.
 */
function generateShareToken(): string {
  const chars: string[] = [];
  while (chars.length < TOKEN_LENGTH) {
    const bytes = randomBytes(TOKEN_LENGTH - chars.length);
    for (const byte of bytes) {
      if (byte >= 248) continue;
      chars.push(BASE62[byte % 62]);
      if (chars.length === TOKEN_LENGTH) break;
    }
  }
  return chars.join("");
}

/* ── Owner-side share management ──────────────────────────────────────── */

export async function createShare(
  ownerUserId: string,
  tripId: string,
  permission: SharePermission,
): Promise<TripShareRow> {
  await getTrip(ownerUserId, tripId); // owner-only

  const db = await getDb();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ id: schema.tripShares.id })
    .from(schema.tripShares)
    .where(
      and(
        eq(schema.tripShares.ownerUserId, ownerUserId),
        gt(schema.tripShares.createdAt, oneDayAgo),
      ),
    );
  if (recent.length >= SHARE_RATE_LIMIT_PER_DAY) throw new ShareRateLimitError();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(schema.tripShares)
        .values({ tripId, ownerUserId, token: generateShareToken(), permission })
        .returning();
      return row;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error;
      // Near-impossible token collision — retry with a fresh token.
    }
  }
  throw new Error("unreachable");
}

export async function listShares(
  ownerUserId: string,
  tripId: string,
): Promise<TripShareRow[]> {
  await getTrip(ownerUserId, tripId); // owner-only
  const db = await getDb();
  return db
    .select()
    .from(schema.tripShares)
    .where(eq(schema.tripShares.tripId, tripId))
    .orderBy(desc(schema.tripShares.createdAt));
}

async function getOwnedShare(
  ownerUserId: string,
  shareId: string,
): Promise<TripShareRow> {
  const db = await getDb();
  const [share] = await db
    .select()
    .from(schema.tripShares)
    .where(eq(schema.tripShares.id, shareId))
    .limit(1);
  if (!share || share.ownerUserId !== ownerUserId) throw new OwnershipError();
  return share;
}

/** Returns the updated row so callers can invalidate the public page's cache tag (`share:{token}`). */
export async function setPermission(
  ownerUserId: string,
  shareId: string,
  permission: SharePermission,
): Promise<TripShareRow> {
  await getOwnedShare(ownerUserId, shareId);
  const db = await getDb();
  const [row] = await db
    .update(schema.tripShares)
    .set({ permission })
    .where(eq(schema.tripShares.id, shareId))
    .returning();
  return row;
}

/** Returns the updated row so callers can invalidate the public page's cache tag (`share:{token}`). */
export async function revokeShare(
  ownerUserId: string,
  shareId: string,
): Promise<TripShareRow> {
  await getOwnedShare(ownerUserId, shareId);
  const db = await getDb();
  const [row] = await db
    .update(schema.tripShares)
    .set({ isRevoked: true })
    .where(eq(schema.tripShares.id, shareId))
    .returning();
  return row;
}

export interface OwnedShareView {
  id: string;
  tripId: string;
  tripTitle: string;
  destinationCity: string;
  token: string;
  permission: SharePermission;
  isRevoked: boolean;
  viewCount: number;
  createdAt: Date;
}

/** All shares this user owns, across every trip — for the Settings "Sharing" card. */
export async function listAllSharesForUser(
  ownerUserId: string,
): Promise<OwnedShareView[]> {
  const db = await getDb();
  return db
    .select({
      id: schema.tripShares.id,
      tripId: schema.tripShares.tripId,
      tripTitle: schema.trips.title,
      destinationCity: schema.trips.destinationCity,
      token: schema.tripShares.token,
      permission: schema.tripShares.permission,
      isRevoked: schema.tripShares.isRevoked,
      viewCount: schema.tripShares.viewCount,
      createdAt: schema.tripShares.createdAt,
    })
    .from(schema.tripShares)
    .innerJoin(schema.trips, eq(schema.tripShares.tripId, schema.trips.id))
    .where(eq(schema.tripShares.ownerUserId, ownerUserId))
    .orderBy(desc(schema.tripShares.createdAt));
}

/* ── Token-gated public read (no session required — auth is possession) ── */

export interface ActiveShare {
  share: TripShareRow;
  trip: TripRow;
}

/**
 * Fresh, uncached read for auth-sensitive checks (join, revoke-while-open
 * detection, calendar ?token= fallback). Never routed through the public
 * page's 60s cache — every caller here needs a live answer.
 */
export async function getActiveShareByToken(
  token: string,
): Promise<ActiveShare | null> {
  const db = await getDb();
  const [share] = await db
    .select()
    .from(schema.tripShares)
    .where(eq(schema.tripShares.token, token))
    .limit(1);
  if (!share || share.isRevoked) return null;
  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.id, share.tripId))
    .limit(1);
  if (!trip) return null;
  return { share, trip };
}

export interface SharedTripView {
  shareId: string;
  tripId: string;
  permission: SharePermission;
  ownerDisplayName: string | null;
  trip: {
    id: string;
    title: string;
    destinationCity: string;
    destinationCountry: string | null;
    startDate: Date;
    endDate: Date;
    coverSeed: number;
    status: ReturnType<typeof statusOf>;
  };
  items: (ItineraryItemRow & { createdByDisplayName: string | null })[];
}

/**
 * The privacy-narrowed read for the public /s/[token] page (this is the
 * function a caller wraps in `unstable_cache`, not getActiveShareByToken).
 * Selects an explicit column list — never `users.email`/`totalSavedCents`,
 * never `bookings`/`passportStamps` — so those columns are structurally
 * never fetched in this code path, not merely omitted from the response.
 */
export async function getSharedTripView(
  token: string,
): Promise<SharedTripView | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      shareId: schema.tripShares.id,
      permission: schema.tripShares.permission,
      isRevoked: schema.tripShares.isRevoked,
      ownerUserId: schema.tripShares.ownerUserId,
      tripId: schema.trips.id,
      title: schema.trips.title,
      destinationCity: schema.trips.destinationCity,
      destinationCountry: schema.trips.destinationCountry,
      startDate: schema.trips.startDate,
      endDate: schema.trips.endDate,
      coverSeed: schema.trips.coverSeed,
    })
    .from(schema.tripShares)
    .innerJoin(schema.trips, eq(schema.tripShares.tripId, schema.trips.id))
    .where(eq(schema.tripShares.token, token))
    .limit(1);
  if (!row || row.isRevoked) return null;

  const [owner] = await db
    .select({ displayName: schema.users.displayName })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerUserId))
    .limit(1);

  const itemRows = await db
    .select({
      item: schema.itineraryItems,
      createdByDisplayName: schema.users.displayName,
    })
    .from(schema.itineraryItems)
    .leftJoin(
      schema.users,
      eq(schema.itineraryItems.createdByUserId, schema.users.id),
    )
    .where(eq(schema.itineraryItems.tripId, row.tripId))
    .orderBy(
      asc(schema.itineraryItems.dayIndex),
      asc(schema.itineraryItems.sortOrder),
    );

  return {
    shareId: row.shareId,
    tripId: row.tripId,
    permission: row.permission,
    ownerDisplayName: owner?.displayName ?? null,
    trip: {
      id: row.tripId,
      title: row.title,
      destinationCity: row.destinationCity,
      destinationCountry: row.destinationCountry,
      startDate: row.startDate,
      endDate: row.endDate,
      coverSeed: row.coverSeed,
      status: statusOf({ startDate: row.startDate, endDate: row.endDate }),
    },
    items: itemRows.map((item) => ({
      ...item.item,
      createdByDisplayName: item.createdByDisplayName,
    })),
  };
}

/* ── IP abuse guard + view-count dedup for /s/[token] (task 5) ─────────── */

const IP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const IP_RATE_LIMIT_MAX = 60;
const VIEW_COUNT_DEDUP_WINDOW_MS = 60 * 60 * 1000;

/** Salted hash of a raw IP — never persist the address itself. */
export function hashLookupIp(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "wanderlost-dev-secret-change-me"}:${ip}`)
    .digest("hex");
}

export interface ShareLookupResult {
  allowed: boolean;
}

/**
 * Records one /s/[token] visit. Generous limit (this token already has
 * ~131 bits of entropy — brute force isn't the threat this guards against;
 * scraping/DoS/view-count inflation is), and increments trip_shares'
 * view_count only on the first sighting of this (token, ipHash) pair in an
 * hour, avoiding write-amplification from repeat loads/prefetches.
 */
export async function recordShareLookup(
  token: string,
  ipHash: string,
): Promise<ShareLookupResult> {
  const db = await getDb();
  const now = new Date();

  const rateLimitWindowStart = new Date(now.getTime() - IP_RATE_LIMIT_WINDOW_MS);
  const recentFromIp = await db
    .select({ id: schema.shareLookupAttempts.id })
    .from(schema.shareLookupAttempts)
    .where(
      and(
        eq(schema.shareLookupAttempts.ipHash, ipHash),
        gt(schema.shareLookupAttempts.createdAt, rateLimitWindowStart),
      ),
    );
  if (recentFromIp.length >= IP_RATE_LIMIT_MAX) return { allowed: false };

  const dedupWindowStart = new Date(now.getTime() - VIEW_COUNT_DEDUP_WINDOW_MS);
  const seenRecently = await db
    .select({ id: schema.shareLookupAttempts.id })
    .from(schema.shareLookupAttempts)
    .where(
      and(
        eq(schema.shareLookupAttempts.token, token),
        eq(schema.shareLookupAttempts.ipHash, ipHash),
        gt(schema.shareLookupAttempts.createdAt, dedupWindowStart),
      ),
    )
    .limit(1);

  await db.insert(schema.shareLookupAttempts).values({ token, ipHash });

  if (seenRecently.length === 0) {
    await db
      .update(schema.tripShares)
      .set({ viewCount: sql`${schema.tripShares.viewCount} + 1` })
      .where(eq(schema.tripShares.token, token));
  }

  return { allowed: true };
}

/* ── Collaborator lifecycle ──────────────────────────────────────────── */

export async function joinAsCollaborator(
  token: string,
  userId: string,
): Promise<TripCollaboratorRow | { alreadyOwner: true }> {
  const active = await getActiveShareByToken(token);
  if (!active) throw new ShareGoneError();
  const { share } = active;
  if (share.ownerUserId === userId) return { alreadyOwner: true };
  if (share.permission !== "edit") throw new ShareNotEditableError();

  const db = await getDb();
  try {
    const [row] = await db
      .insert(schema.tripCollaborators)
      .values({
        tripId: share.tripId,
        userId,
        role: "editor",
        joinedViaShareId: share.id,
        notifyOptIn: false,
      })
      .returning();
    return row;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Idempotent re-join: an active edit-link always wins, re-upgrading a
    // previously owner-downgraded viewer back to editor.
    const [updated] = await db
      .update(schema.tripCollaborators)
      .set({ role: "editor", joinedViaShareId: share.id })
      .where(
        and(
          eq(schema.tripCollaborators.tripId, share.tripId),
          eq(schema.tripCollaborators.userId, userId),
        ),
      )
      .returning();
    return updated;
  }
}

async function getOwnedCollaborator(
  ownerUserId: string,
  collaboratorId: string,
): Promise<TripCollaboratorRow> {
  const db = await getDb();
  const rows = await db
    .select({
      collaborator: schema.tripCollaborators,
      tripOwnerUserId: schema.trips.userId,
    })
    .from(schema.tripCollaborators)
    .innerJoin(schema.trips, eq(schema.tripCollaborators.tripId, schema.trips.id))
    .where(eq(schema.tripCollaborators.id, collaboratorId))
    .limit(1);
  const row = rows[0];
  if (!row || row.tripOwnerUserId !== ownerUserId) throw new OwnershipError();
  return row.collaborator;
}

export async function removeCollaborator(
  ownerUserId: string,
  collaboratorId: string,
): Promise<void> {
  await getOwnedCollaborator(ownerUserId, collaboratorId);
  const db = await getDb();
  await db
    .delete(schema.tripCollaborators)
    .where(eq(schema.tripCollaborators.id, collaboratorId));
}

export async function setCollaboratorRole(
  ownerUserId: string,
  collaboratorId: string,
  role: CollaboratorRole,
): Promise<void> {
  await getOwnedCollaborator(ownerUserId, collaboratorId);
  const db = await getDb();
  await db
    .update(schema.tripCollaborators)
    .set({ role })
    .where(eq(schema.tripCollaborators.id, collaboratorId));
}

export async function setCollaboratorNotifyOptIn(
  userId: string,
  tripId: string,
  notifyOptIn: boolean,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.tripCollaborators)
    .set({ notifyOptIn })
    .where(
      and(
        eq(schema.tripCollaborators.tripId, tripId),
        eq(schema.tripCollaborators.userId, userId),
      ),
    );
}

/** Self-service: a collaborator leaving a trip they were invited to. No owner check. */
export async function leaveTrip(userId: string, tripId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.tripCollaborators)
    .where(
      and(
        eq(schema.tripCollaborators.tripId, tripId),
        eq(schema.tripCollaborators.userId, userId),
      ),
    );
}

export interface CollaboratorView {
  id: string;
  userId: string;
  displayName: string | null;
  role: CollaboratorRole;
  createdAt: Date;
}

/** Collaborator list for the owner's share sheet. */
export async function listCollaborators(
  ownerUserId: string,
  tripId: string,
): Promise<CollaboratorView[]> {
  await getTrip(ownerUserId, tripId); // owner-only
  const db = await getDb();
  return db
    .select({
      id: schema.tripCollaborators.id,
      userId: schema.tripCollaborators.userId,
      displayName: schema.users.displayName,
      role: schema.tripCollaborators.role,
      createdAt: schema.tripCollaborators.createdAt,
    })
    .from(schema.tripCollaborators)
    .innerJoin(schema.users, eq(schema.tripCollaborators.userId, schema.users.id))
    .where(eq(schema.tripCollaborators.tripId, tripId))
    .orderBy(asc(schema.tripCollaborators.createdAt));
}

/**
 * Collaborator display names for a trip, visible to anyone with view
 * access (not owner-only like `listCollaborators`) — used for "added by
 * {name}" attribution chips on the owner's own itinerary page, which any
 * collaborator can also load.
 */
export async function listCollaboratorNamesForViewer(
  userId: string,
  tripId: string,
): Promise<Record<string, string>> {
  await assertCanView(userId, tripId);
  const db = await getDb();
  const rows = await db
    .select({
      userId: schema.tripCollaborators.userId,
      displayName: schema.users.displayName,
    })
    .from(schema.tripCollaborators)
    .innerJoin(schema.users, eq(schema.tripCollaborators.userId, schema.users.id))
    .where(eq(schema.tripCollaborators.tripId, tripId));
  const names: Record<string, string> = {};
  for (const row of rows) {
    if (row.displayName) names[row.userId] = row.displayName;
  }
  return names;
}

export interface CollaboratingTripView {
  trip: TripRow;
  role: CollaboratorRole;
  ownerDisplayName: string | null;
}

/** Trips this user collaborates on (not owns) — for the "Shared with you" dashboard section. */
export async function listCollaboratingTrips(
  userId: string,
): Promise<CollaboratingTripView[]> {
  const db = await getDb();
  return db
    .select({
      trip: schema.trips,
      role: schema.tripCollaborators.role,
      ownerDisplayName: schema.users.displayName,
    })
    .from(schema.tripCollaborators)
    .innerJoin(schema.trips, eq(schema.tripCollaborators.tripId, schema.trips.id))
    .innerJoin(schema.users, eq(schema.trips.userId, schema.users.id))
    .where(eq(schema.tripCollaborators.userId, userId))
    .orderBy(desc(schema.trips.startDate));
}
