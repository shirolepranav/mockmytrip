// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * @phase8 push service suite against embedded in-memory PGlite, with
 * `web-push` mocked at the module boundary: milestone boundary matching
 * (30d/7d/1d/departure/memory), the one-candidate-per-user-per-run rule,
 * the 1/day cap, opt-in gating, and dead-subscription pruning on send.
 */

process.env.PGLITE_MEMORY = "1";
process.env.VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

// vi.mock factories are hoisted above every top-level declaration in this
// file (including classes) — vi.hoisted() creates everything the factory
// below needs in that same hoisted scope, avoiding a TDZ error.
const { sendNotificationMock, setVapidDetailsMock, MockWebPushError } = vi.hoisted(() => {
  class MockWebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    sendNotificationMock: vi.fn(),
    setVapidDetailsMock: vi.fn(),
    MockWebPushError,
  };
});

vi.mock("web-push", () => ({
  default: {
    sendNotification: sendNotificationMock,
    setVapidDetails: setVapidDetailsMock,
  },
  WebPushError: MockWebPushError,
}));

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { addItineraryItem } from "@/lib/services/itinerary";
import { createShare, joinAsCollaborator } from "@/lib/services/shares";
import {
  listCollaboratorDigestCandidates,
  listMilestoneCandidates,
  removeSubscription,
  sendCollaboratorDigest,
  sendMilestonePush,
  upsertSubscription,
} from "./push";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

beforeEach(() => {
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
});

async function setOptIn(userId: string, notifOptIn: boolean) {
  const db = await getDb();
  await db.update(schema.users).set({ prefsJson: { notifOptIn } }).where(eq(schema.users.id, userId));
}

async function makeOptedInUserWithSubscription(endpoint: string) {
  const user = await createGuest();
  await upsertSubscription(user.id, {
    endpoint,
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
  });
  await setOptIn(user.id, true); // upsertSubscription already sets this, but explicit for test clarity
  return user;
}

async function makeTripStartingIn(userId: string, days: number, city = "Lisbon") {
  const now = Date.now();
  return createTrip(userId, {
    title: "Test trip",
    destinationCity: city,
    destinationCountry: "PT",
    startDate: new Date(now + days * DAY_MS),
    endDate: new Date(now + (days + 3) * DAY_MS),
  });
}

async function makeTripEndingToday(userId: string, city = "Lisbon") {
  const now = Date.now();
  return createTrip(userId, {
    title: "Just-finished trip",
    destinationCity: city,
    destinationCountry: "PT",
    startDate: new Date(now - 5 * DAY_MS),
    endDate: new Date(now),
  });
}

// listMilestoneCandidates queries the whole (shared, embedded) database —
// every test below filters to its own user.id, since earlier tests' users/
// trips/subscriptions persist in that same database across cases.

describe("@phase8 listMilestoneCandidates", () => {
  it("matches the 30-day milestone", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/30d");
    await makeTripStartingIn(user.id, 30);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: user.id, milestone: "30d" }),
    ]);
  });

  it("matches the 7-day milestone", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/7d");
    await makeTripStartingIn(user.id, 7);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: user.id, milestone: "7d" }),
    ]);
  });

  it("matches the 1-day milestone", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/1d");
    await makeTripStartingIn(user.id, 1);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: user.id, milestone: "1d" }),
    ]);
  });

  it("matches the departure-day milestone", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/dep");
    await makeTripStartingIn(user.id, 0);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: user.id, milestone: "departure" }),
    ]);
  });

  it("matches the memory-unlocked milestone the day a trip ends", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/mem");
    await makeTripEndingToday(user.id);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: user.id, milestone: "memory" }),
    ]);
  });

  it("does not match a trip departing in 15 days (no milestone that day)", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/none");
    await makeTripStartingIn(user.id, 15);
    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === user.id);
    expect(candidates).toEqual([]);
  });

  it("caps at one candidate per user even with two qualifying trips", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/two");
    await makeTripStartingIn(user.id, 30, "Lisbon");
    await makeTripStartingIn(user.id, 7, "Porto");
    const candidates = await listMilestoneCandidates();
    const forUser = candidates.filter((c) => c.userId === user.id);
    expect(forUser).toHaveLength(1);
  });

  it("excludes a user who hasn't opted in", async () => {
    const user = await createGuest();
    await upsertSubscription(user.id, {
      endpoint: "https://push.example/optout",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
    // Opt back out immediately — upsertSubscription flips it on by default.
    await setOptIn(user.id, false);
    await makeTripStartingIn(user.id, 30);
    const candidates = await listMilestoneCandidates();
    expect(candidates.filter((c) => c.userId === user.id)).toEqual([]);
  });

  it("excludes a user with no push subscription", async () => {
    const user = await createGuest();
    await setOptIn(user.id, true);
    await makeTripStartingIn(user.id, 30);
    const candidates = await listMilestoneCandidates();
    expect(candidates.filter((c) => c.userId === user.id)).toEqual([]);
  });

  it("enforces the 1/day cap: a user already sent to today is excluded", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/capped");
    await makeTripStartingIn(user.id, 30);
    const db = await getDb();
    await db
      .update(schema.pushSubscriptions)
      .set({ lastSentAt: new Date() })
      .where(eq(schema.pushSubscriptions.userId, user.id));
    const candidates = await listMilestoneCandidates();
    expect(candidates.filter((c) => c.userId === user.id)).toEqual([]);
  });
});

describe("@phase8 sendMilestonePush", () => {
  it("sends to every subscription and stamps lastSentAt on success", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/send-ok");
    const trip = await makeTripStartingIn(user.id, 30);
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });

    await sendMilestonePush({
      tripId: trip.id,
      userId: user.id,
      milestone: "30d",
      destinationCity: "Lisbon",
    });

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const db = await getDb();
    const [row] = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, user.id));
    expect(row.lastSentAt).not.toBeNull();
  });

  it("prunes a subscription that 404s", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/dead");
    const trip = await makeTripStartingIn(user.id, 30);
    sendNotificationMock.mockRejectedValue(new MockWebPushError("gone", 404));

    await sendMilestonePush({
      tripId: trip.id,
      userId: user.id,
      milestone: "30d",
      destinationCity: "Lisbon",
    });

    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, user.id));
    expect(rows).toHaveLength(0);
  });

  it("does nothing when VAPID keys are unset", async () => {
    const originalPublic = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    const user = await makeOptedInUserWithSubscription("https://push.example/novapid");
    const trip = await makeTripStartingIn(user.id, 30);

    await sendMilestonePush({
      tripId: trip.id,
      userId: user.id,
      milestone: "30d",
      destinationCity: "Lisbon",
    });

    expect(sendNotificationMock).not.toHaveBeenCalled();
    process.env.VAPID_PUBLIC_KEY = originalPublic;
  });
});

describe("@phase8 removeSubscription", () => {
  it("flips notifOptIn off once the last subscription is removed", async () => {
    const user = await makeOptedInUserWithSubscription("https://push.example/last");
    await removeSubscription(user.id, "https://push.example/last");
    const db = await getDb();
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row.prefsJson.notifOptIn).toBe(false);
  });
});

async function makeEditorCollaborator(ownerId: string, tripId: string, endpoint: string) {
  const editor = await makeOptedInUserWithSubscription(endpoint);
  const share = await createShare(ownerId, tripId, "edit");
  const membership = await joinAsCollaborator(share.token, editor.id);
  if ("alreadyOwner" in membership) throw new Error("unexpected");
  const db = await getDb();
  await db
    .update(schema.tripCollaborators)
    .set({ notifyOptIn: true })
    .where(eq(schema.tripCollaborators.id, membership.id));
  return editor;
}

describe("@phase9 collaborator milestone opt-in", () => {
  it("a collaborator with their own notify_opt_in gets milestone pushes for that trip", async () => {
    const owner = await createGuest();
    const trip = await makeTripStartingIn(owner.id, 7, "Porto");
    const editor = await makeEditorCollaborator(owner.id, trip.id, "https://push.example/collab-7d");

    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === editor.id);
    expect(candidates).toEqual([
      expect.objectContaining({ userId: editor.id, tripId: trip.id, milestone: "7d" }),
    ]);
  });

  it("a collaborator without notify_opt_in on their membership gets nothing", async () => {
    const owner = await createGuest();
    const editor = await makeOptedInUserWithSubscription("https://push.example/collab-no-optin");
    const trip = await makeTripStartingIn(owner.id, 7, "Vienna");
    const share = await createShare(owner.id, trip.id, "edit");
    await joinAsCollaborator(share.token, editor.id); // notifyOptIn defaults to false

    const candidates = (await listMilestoneCandidates()).filter((c) => c.userId === editor.id);
    expect(candidates).toEqual([]);
  });

  it("the owner's own opted-in push is unaffected by a collaborator also being opted in", async () => {
    const owner = await makeOptedInUserWithSubscription("https://push.example/owner-still-works");
    const trip = await makeTripStartingIn(owner.id, 7, "Athens");
    await makeEditorCollaborator(owner.id, trip.id, "https://push.example/collab-alongside-owner");

    const ownerCandidates = (await listMilestoneCandidates()).filter((c) => c.userId === owner.id);
    expect(ownerCandidates).toEqual([
      expect.objectContaining({ userId: owner.id, tripId: trip.id, milestone: "7d" }),
    ]);
  });
});

describe("@phase9 listCollaboratorDigestCandidates / sendCollaboratorDigest", () => {
  it("a trip with a new collaborator-authored item is a digest candidate", async () => {
    const owner = await createGuest();
    const trip = await makeTripStartingIn(owner.id, 20, "Marrakech");
    const share = await createShare(owner.id, trip.id, "edit");
    const membership = await joinAsCollaborator(share.token, (await createGuest()).id);
    if ("alreadyOwner" in membership) throw new Error("unexpected");
    await addItineraryItem(membership.userId, trip.id, {
      dayIndex: 0,
      title: "Souk wandering",
      category: "activity",
    });

    const candidates = (await listCollaboratorDigestCandidates()).filter(
      (c) => c.tripId === trip.id,
    );
    expect(candidates).toEqual([
      expect.objectContaining({ tripId: trip.id, ownerUserId: owner.id, newItemCount: 1 }),
    ]);
  });

  it("items the owner added themselves never trigger a digest", async () => {
    const owner = await createGuest();
    const trip = await makeTripStartingIn(owner.id, 20, "Helsinki");
    await addItineraryItem(owner.id, trip.id, {
      dayIndex: 0,
      title: "Owner's own idea",
      category: "activity",
    });

    const candidates = (await listCollaboratorDigestCandidates()).filter(
      (c) => c.tripId === trip.id,
    );
    expect(candidates).toEqual([]);
  });

  it("sendCollaboratorDigest advances the cursor so the same items don't re-trigger a same-day digest", async () => {
    const owner = await makeOptedInUserWithSubscription("https://push.example/digest-owner");
    const trip = await makeTripStartingIn(owner.id, 20, "Tallinn");
    const share = await createShare(owner.id, trip.id, "edit");
    const membership = await joinAsCollaborator(share.token, (await createGuest()).id);
    if ("alreadyOwner" in membership) throw new Error("unexpected");
    await addItineraryItem(membership.userId, trip.id, {
      dayIndex: 0,
      title: "Old town walk",
      category: "sight",
    });

    const [before] = (await listCollaboratorDigestCandidates()).filter(
      (c) => c.tripId === trip.id,
    );
    expect(before).toBeDefined();
    await sendCollaboratorDigest(before);

    const after = (await listCollaboratorDigestCandidates()).filter((c) => c.tripId === trip.id);
    expect(after).toEqual([]);
  });
});
