// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase2 services suite against embedded in-memory PGlite:
 * QA 2.1–2.8 (guest identity, magic-link merge, rate limit, ownership,
 * export, delete, migration/seed smoke).
 */

process.env.PGLITE_MEMORY = "1";

import { getDb, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import {
  createGuest,
  deleteAll,
  exportData,
  getOrCreateGuest,
  getUser,
} from "./users";
import {
  createTrip,
  deleteTrip,
  getDraft,
  getTrip,
  listTrips,
  renameTrip,
  saveDraft,
  statusOf,
} from "./trips";
import { OwnershipError } from "./ownership";
import {
  InvalidTokenError,
  RateLimitError,
  requestMagicLink,
  verifyMagicLink,
} from "./auth";
import { seedAll } from "./seed-db";
import { signSessionValue, verifySessionValue } from "@/lib/auth/session";

const tripDates = {
  startDate: new Date("2026-08-21T00:00:00Z"),
  endDate: new Date("2026-08-26T00:00:00Z"),
};

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

describe("@phase2 sessions", () => {
  it("signs and verifies session values; tampering fails", () => {
    const value = signSessionValue("user-123");
    expect(verifySessionValue(value)).toBe("user-123");
    expect(verifySessionValue(value.replace(/.$/, "x"))).toBeNull();
    expect(verifySessionValue("user-456." + value.split(".")[1])).toBeNull();
    expect(verifySessionValue("garbage")).toBeNull();
  });
});

describe("@phase2 guest identity", () => {
  it("2.1/2.2 creates a guest once and reuses it", async () => {
    const guest = await createGuest();
    expect(guest.isGuest).toBe(true);
    const again = await getOrCreateGuest(guest.id);
    expect(again.id).toBe(guest.id);
    const fresh = await getOrCreateGuest(null);
    expect(fresh.id).not.toBe(guest.id);
  });
});

describe("@phase2 trips + ownership", () => {
  it("creates, lists, renames, deletes trips", async () => {
    const user = await createGuest();
    const trip = await createTrip(user.id, {
      title: "5 days in Lisbon",
      destinationCity: "Lisbon",
      destinationCountry: "PT",
      ...tripDates,
    });
    expect(trip.coverSeed).toBeGreaterThan(0);

    await renameTrip(user.id, trip.id, "Lisbon dream");
    const listed = await listTrips(user.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Lisbon dream");

    await deleteTrip(user.id, trip.id);
    expect(await listTrips(user.id)).toHaveLength(0);
  });

  it("2.5 forged access to another user's trip is denied without leaking", async () => {
    const alice = await createGuest();
    const mallory = await createGuest();
    const trip = await createTrip(alice.id, {
      title: "Alice's trip",
      destinationCity: "Tokyo",
      ...tripDates,
    });
    await expect(getTrip(mallory.id, trip.id)).rejects.toThrow(OwnershipError);
    await expect(
      renameTrip(mallory.id, trip.id, "hacked"),
    ).rejects.toThrow("Not found");
    await expect(deleteTrip(mallory.id, trip.id)).rejects.toThrow("Not found");
  });

  it("statusOf derives upcoming/in_progress/memory", () => {
    const trip = {
      startDate: new Date("2026-08-21T00:00:00Z"),
      endDate: new Date("2026-08-26T00:00:00Z"),
    };
    expect(statusOf(trip, new Date("2026-08-01"))).toBe("upcoming");
    expect(statusOf(trip, new Date("2026-08-23"))).toBe("in_progress");
    expect(statusOf(trip, new Date("2026-09-01"))).toBe("memory");
  });

  it("draft save/get/clear round-trips", async () => {
    const user = await createGuest();
    expect(await getDraft(user.id)).toBeNull();
    await saveDraft(user.id, { flight: { id: "F-1" } });
    expect((await getDraft(user.id))?.flight).toEqual({ id: "F-1" });
    await saveDraft(user.id, { flight: { id: "F-2" } });
    expect((await getDraft(user.id))?.flight).toEqual({ id: "F-2" });
  });
});

describe("@phase2 magic link", () => {
  it("2.3 verify signs in and merges guest data; guest row is gone", async () => {
    const guest = await createGuest();
    const trip = await createTrip(guest.id, {
      title: "Guest trip",
      destinationCity: "Paris",
      ...tripDates,
    });
    const { url } = await requestMagicLink(
      "merge-test@example.com",
      "http://localhost:3000",
    );
    const token = new URL(url).searchParams.get("token")!;
    const accountId = await verifyMagicLink(token, guest.id);
    expect(accountId).not.toBe(guest.id);

    const account = await getUser(accountId);
    expect(account?.email).toBe("merge-test@example.com");
    expect(account?.isGuest).toBe(false);

    const trips = await listTrips(accountId);
    expect(trips.map((t) => t.id)).toContain(trip.id);
    expect(await getUser(guest.id)).toBeNull();
  });

  it("tokens are one-time and expire", async () => {
    const { url } = await requestMagicLink(
      "one-time@example.com",
      "http://localhost:3000",
    );
    const token = new URL(url).searchParams.get("token")!;
    await verifyMagicLink(token, null);
    await expect(verifyMagicLink(token, null)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it("2.4 fourth request within an hour is rate limited", async () => {
    for (let i = 0; i < 3; i++) {
      await requestMagicLink("rate-limit@example.com", "http://localhost:3000");
    }
    await expect(
      requestMagicLink("rate-limit@example.com", "http://localhost:3000"),
    ).rejects.toThrow(RateLimitError);
  });
});

describe("@phase2 export & delete", () => {
  it("2.6 export contains all and only the user's rows", async () => {
    const alice = await createGuest();
    const bob = await createGuest();
    const aliceTrip = await createTrip(alice.id, {
      title: "Alice only",
      destinationCity: "Rome",
      ...tripDates,
    });
    await createTrip(bob.id, {
      title: "Bob only",
      destinationCity: "Oslo",
      ...tripDates,
    });

    const data = await exportData(alice.id);
    expect(data?.user.id).toBe(alice.id);
    expect(data?.trips.map((t) => t.id)).toEqual([aliceTrip.id]);
    expect(JSON.stringify(data)).not.toContain("Bob only");
    expect(data?.note).toContain("SIMULATION");
  });

  it("2.7 delete cascades every owned row", async () => {
    const user = await createGuest();
    const trip = await createTrip(user.id, {
      title: "Doomed trip",
      destinationCity: "Bergen",
      ...tripDates,
    });
    await saveDraft(user.id, { flight: { id: "F-9" } });
    await deleteAll(user.id);

    expect(await getUser(user.id)).toBeNull();
    const db = await getDb();
    const orphanTrips = await db
      .select()
      .from(schema.trips)
      .where(eq(schema.trips.id, trip.id));
    expect(orphanTrips).toHaveLength(0);
    const orphanDrafts = await db
      .select()
      .from(schema.tripDrafts)
      .where(eq(schema.tripDrafts.userId, user.id));
    expect(orphanDrafts).toHaveLength(0);
  });
});

describe("@phase2 migrations & seed", () => {
  it("2.8 seed is idempotent and loads airports (>2,000) + ~40 airlines", async () => {
    const first = await seedAll();
    expect(first.airports).toBeGreaterThan(2000);
    expect(first.airlines).toBe(40);
    const second = await seedAll();
    expect(second).toEqual({ airports: 0, airlines: 0 });

    const db = await getDb();
    const jfk = await db
      .select()
      .from(schema.airports)
      .where(eq(schema.airports.iataCode, "JFK"));
    expect(jfk[0]?.tz).toBe("America/New_York");
  }, 60_000);
});
