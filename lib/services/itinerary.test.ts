// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase7 itinerary service suite against embedded in-memory PGlite:
 * CRUD, day-index clamping (QA 7.3), reorder persistence (QA 7.2), and
 * ownership denial (QA 7.9).
 */

process.env.PGLITE_MEMORY = "1";

import { getDb } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { OwnershipError } from "./ownership";
import {
  addItineraryItem,
  deleteItineraryItem,
  listItineraryItems,
  reorderItineraryItems,
  tripLengthDays,
  updateItineraryItem,
} from "./itinerary";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

async function makeTrip(userId: string, days: number) {
  const startDate = new Date("2026-09-01T00:00:00Z");
  const endDate = new Date(startDate.getTime() + (days - 1) * 86_400_000);
  return createTrip(userId, {
    title: "Test trip",
    destinationCity: "Lisbon",
    destinationCountry: "PT",
    startDate,
    endDate,
  });
}

describe("@phase7 tripLengthDays", () => {
  it("a same-day trip is 1 day; a 3-night trip is 4 days", () => {
    const sameDay = new Date("2026-09-01T00:00:00Z");
    expect(tripLengthDays({ startDate: sameDay, endDate: sameDay })).toBe(1);

    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-09-04T00:00:00Z");
    expect(tripLengthDays({ startDate: start, endDate: end })).toBe(4);
  });
});

describe("@phase7 itinerary CRUD", () => {
  it("7.1 add/edit/delete persists; order stable", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id, 3);

    const first = await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "Breakfast",
      category: "food",
    });
    const second = await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "Museum",
      category: "sight",
    });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    await updateItineraryItem(user.id, first.id, { title: "Breakfast at the café" });
    let items = await listItineraryItems(user.id, trip.id);
    expect(items.map((item) => item.title)).toEqual([
      "Breakfast at the café",
      "Museum",
    ]);

    await deleteItineraryItem(user.id, first.id);
    items = await listItineraryItems(user.id, trip.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(second.id);
  });

  it("7.3 an item on a day beyond the trip length is clamped, never rejected silently wrong", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id, 3); // valid dayIndex: 0, 1, 2

    const tooFar = await addItineraryItem(user.id, trip.id, {
      dayIndex: 99,
      title: "Day 100 idea",
      category: "activity",
    });
    expect(tooFar.dayIndex).toBe(2);

    const negative = await addItineraryItem(user.id, trip.id, {
      dayIndex: -5,
      title: "Before the trip starts",
      category: "activity",
    });
    expect(negative.dayIndex).toBe(0);
  });

  it("7.9 another user's itinerary mutation is denied", async () => {
    const owner = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id, 3);
    const item = await addItineraryItem(owner.id, trip.id, {
      dayIndex: 0,
      title: "Owner's plan",
      category: "activity",
    });

    await expect(
      addItineraryItem(stranger.id, trip.id, {
        dayIndex: 0,
        title: "Intruder",
        category: "activity",
      }),
    ).rejects.toThrow(OwnershipError);
    await expect(
      updateItineraryItem(stranger.id, item.id, { title: "Hijacked" }),
    ).rejects.toThrow(OwnershipError);
    await expect(deleteItineraryItem(stranger.id, item.id)).rejects.toThrow(
      OwnershipError,
    );
    await expect(listItineraryItems(stranger.id, trip.id)).rejects.toThrow(
      OwnershipError,
    );
  });
});

describe("@phase7 reorder", () => {
  it("7.2 persists new day/order across a reload-equivalent re-read", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id, 3);
    const a = await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "A",
      category: "activity",
    });
    const b = await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "B",
      category: "activity",
    });
    const c = await addItineraryItem(user.id, trip.id, {
      dayIndex: 1,
      title: "C",
      category: "activity",
    });

    // Move B before A on day 0, and drag C onto day 0 as the last item.
    await reorderItineraryItems(user.id, trip.id, [
      { itemId: b.id, dayIndex: 0, sortOrder: 0 },
      { itemId: a.id, dayIndex: 0, sortOrder: 1 },
      { itemId: c.id, dayIndex: 0, sortOrder: 2 },
    ]);

    const items = await listItineraryItems(user.id, trip.id);
    expect(items.map((item) => item.title)).toEqual(["B", "A", "C"]);
    expect(items.every((item) => item.dayIndex === 0)).toBe(true);
  });

  it("clamps a reorder move to a day beyond the trip length", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id, 2); // valid dayIndex: 0, 1
    const item = await addItineraryItem(user.id, trip.id, {
      dayIndex: 0,
      title: "Only item",
      category: "activity",
    });

    await reorderItineraryItems(user.id, trip.id, [
      { itemId: item.id, dayIndex: 50, sortOrder: 0 },
    ]);
    const [reloaded] = await listItineraryItems(user.id, trip.id);
    expect(reloaded.dayIndex).toBe(1);
  });

  it("ignores an itemId that doesn't belong to the trip", async () => {
    const user = await createGuest();
    const tripA = await makeTrip(user.id, 3);
    const tripB = await makeTrip(user.id, 3);
    const itemInB = await addItineraryItem(user.id, tripB.id, {
      dayIndex: 0,
      title: "Belongs to trip B",
      category: "activity",
    });

    await reorderItineraryItems(user.id, tripA.id, [
      { itemId: itemInB.id, dayIndex: 0, sortOrder: 0 },
    ]);

    const itemsB = await listItineraryItems(user.id, tripB.id);
    expect(itemsB[0].dayIndex).toBe(0); // untouched
  });
});
