import { and, eq, gte, lte, sql } from "drizzle-orm";
import webpush, { WebPushError } from "web-push";
import { getDb, schema } from "@/lib/db/client";
import { updatePrefs } from "@/lib/services/users";

/*
 * Web push (Phase 8 task 4): opt-in subscription management + the
 * milestone-notification cron. `push_subscriptions` and
 * `users.prefs_json.notifOptIn` were already in the schema (migrated in
 * drizzle/0000_init.sql) — this just wires them up.
 */

export type PushSubscriptionRow = typeof schema.pushSubscriptions.$inferSelect;

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Save (or reassign) a subscription, and flip the opt-in flag on. */
export async function upsertSubscription(
  userId: string,
  subscription: SubscriptionInput,
): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });
  await updatePrefs(userId, { notifOptIn: true });
}

/** Remove a subscription. Flips the opt-in flag off only when it was the last one. */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, endpoint)),
    );
  const remaining = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))
    .limit(1);
  if (remaining.length === 0) await updatePrefs(userId, { notifOptIn: false });
}

export type Milestone = "30d" | "7d" | "1d" | "departure" | "memory";

export interface MilestoneCandidate {
  tripId: string;
  userId: string;
  milestone: Milestone;
  destinationCity: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKAHEAD_DAYS = 31;
const LOOKBACK_DAYS = 2;

function utcDayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Which single milestone (if any) a trip is due for, given `nowMs`. */
function milestoneFor(startMs: number, endMs: number, nowMs: number): Milestone | null {
  const daysUntilStart = Math.round((startMs - nowMs) / DAY_MS);
  if (daysUntilStart === 30) return "30d";
  if (daysUntilStart === 7) return "7d";
  if (daysUntilStart === 1) return "1d";
  if (daysUntilStart === 0) return "departure";
  // "Memory unlocked" fires the same UTC day the trip ends — day-granularity
  // is intentional here (an hourly cron, not a to-the-minute countdown), so
  // this doesn't need destination-timezone precision the way the trip
  // detail page's isDepartureDay check does for a live countdown display.
  if (utcDayString(endMs) === utcDayString(nowMs)) return "memory";
  return null;
}

/**
 * Trips due for exactly one milestone push each, for opted-in users with at
 * least one subscription who haven't already been sent a push today (the
 * "max 1/day/user" cap — enforced per user, not per device, since a push
 * goes to every one of a user's subscribed devices at once). At most one
 * candidate per user per run, even if multiple trips qualify.
 */
export async function listMilestoneCandidates(
  nowMs = Date.now(),
): Promise<MilestoneCandidate[]> {
  const db = await getDb();
  const windowStart = new Date(nowMs - LOOKBACK_DAYS * DAY_MS);
  const windowEnd = new Date(nowMs + LOOKAHEAD_DAYS * DAY_MS);

  const rows = await db
    .select({
      tripId: schema.trips.id,
      userId: schema.trips.userId,
      startDate: schema.trips.startDate,
      endDate: schema.trips.endDate,
      destinationCity: schema.trips.destinationCity,
    })
    .from(schema.trips)
    .innerJoin(schema.users, eq(schema.trips.userId, schema.users.id))
    .where(
      and(
        sql`${schema.users.prefsJson}->>'notifOptIn' = 'true'`,
        gte(schema.trips.startDate, windowStart),
        lte(schema.trips.startDate, windowEnd),
      ),
    );

  // A trip can also qualify purely on end date (the "memory unlocked"
  // milestone) without its start date falling in the lookahead window —
  // fetched separately since the WHERE above only covers the start-date case.
  const memoryRows = await db
    .select({
      tripId: schema.trips.id,
      userId: schema.trips.userId,
      startDate: schema.trips.startDate,
      endDate: schema.trips.endDate,
      destinationCity: schema.trips.destinationCity,
    })
    .from(schema.trips)
    .innerJoin(schema.users, eq(schema.trips.userId, schema.users.id))
    .where(
      and(
        sql`${schema.users.prefsJson}->>'notifOptIn' = 'true'`,
        gte(schema.trips.endDate, windowStart),
        lte(schema.trips.endDate, new Date(nowMs)),
      ),
    );

  const subscribedUserIds = new Set(
    (await db.select({ userId: schema.pushSubscriptions.userId }).from(schema.pushSubscriptions)).map(
      (row) => row.userId,
    ),
  );

  const todayStart = new Date(utcDayString(nowMs)); // midnight UTC today
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const sentTodayUserIds = new Set(
    (
      await db
        .select({ userId: schema.pushSubscriptions.userId })
        .from(schema.pushSubscriptions)
        .where(
          and(
            gte(schema.pushSubscriptions.lastSentAt, todayStart),
            lte(schema.pushSubscriptions.lastSentAt, todayEnd),
          ),
        )
    ).map((row) => row.userId),
  );

  const candidatesByUser = new Map<string, MilestoneCandidate>();
  for (const row of [...rows, ...memoryRows]) {
    if (candidatesByUser.has(row.userId)) continue; // one candidate per user per run
    if (!subscribedUserIds.has(row.userId) || sentTodayUserIds.has(row.userId)) continue;
    const milestone = milestoneFor(row.startDate.getTime(), row.endDate.getTime(), nowMs);
    if (!milestone) continue;
    candidatesByUser.set(row.userId, {
      tripId: row.tripId,
      userId: row.userId,
      milestone,
      destinationCity: row.destinationCity,
    });
  }
  return [...candidatesByUser.values()];
}

const MILESTONE_COPY: Record<Milestone, (city: string) => { title: string; body: string }> = {
  "30d": (city) => ({
    title: "30 days to go",
    body: `${city} is 30 days away — the countdown continues.`,
  }),
  "7d": (city) => ({
    title: "One week away",
    body: `Just 7 days until ${city}.`,
  }),
  "1d": (city) => ({
    title: "Tomorrow's the day",
    body: `Your simulated trip to ${city} departs tomorrow.`,
  }),
  departure: (city) => ({
    title: "Bon voyage!",
    body: `Today's your simulated departure to ${city}.`,
  }),
  memory: (city) => ({
    title: "Memories ready",
    body: `Your ${city} memories are ready to relive.`,
  }),
};

function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:hello@wanderlost.app", publicKey, privateKey);
  return true;
}

/** Sends one candidate's milestone push to every one of the user's subscribed devices. */
export async function sendMilestonePush(candidate: MilestoneCandidate): Promise<void> {
  if (!configureVapid()) return; // no VAPID keys configured — nothing to send

  const db = await getDb();
  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, candidate.userId));
  if (subscriptions.length === 0) return;

  const { title, body } = MILESTONE_COPY[candidate.milestone](candidate.destinationCity);
  const url =
    candidate.milestone === "memory"
      ? `/trips/${candidate.tripId}/memories`
      : `/trips/${candidate.tripId}`;
  const payload = JSON.stringify({ title, body, url });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      );
      await db
        .update(schema.pushSubscriptions)
        .set({ lastSentAt: new Date() })
        .where(eq(schema.pushSubscriptions.id, subscription.id));
    } catch (error) {
      // 404/410 means the push service considers this endpoint gone for
      // good (uninstalled, permission revoked) — prune it rather than
      // retrying it forever.
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, subscription.id));
      }
    }
  }
}
