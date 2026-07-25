import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getOutboundFlightContext, getTrip } from "./trips";
import { tripLengthDays } from "./itinerary";
import { OwnershipError } from "./ownership";
import { hashSeed, randInt, seededRandom } from "@/lib/engine/seed";

/*
 * Packing services (Phase 7 task 2): an auto-generated starter list keyed
 * off destination climate band + trip length, plus manual add/check/reset.
 */

export type PackingItemRow = typeof schema.packingItems.$inferSelect;
export type ClimateBand = "cold" | "mild" | "hot";
type Season = "winter" | "spring" | "summer" | "fall";

function seasonFor(month: number): Season {
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

/**
 * Destination climate band from latitude + calendar month (1-12).
 * Hemisphere-aware: south of the equator, seasons are inverted, so the
 * month is shifted by 6 before bucketing against the same (northern-coded)
 * season table. Tropical latitudes stay warm-leaning year-round; latitudes
 * beyond ~50° stay cold-leaning outside a mild summer window.
 */
export function climateBandFor(lat: number, month: number): ClimateBand {
  const effectiveMonth = lat < 0 ? ((month + 5) % 12) + 1 : month;
  const season = seasonFor(effectiveMonth);
  const absLat = Math.abs(lat);

  if (absLat < 23.5) return "hot";
  if (absLat >= 50) return season === "summer" ? "mild" : "cold";
  if (season === "winter") return "cold";
  if (season === "summer") return "hot";
  return "mild";
}

const CLOTHING_BY_BAND: Record<ClimateBand, string[]> = {
  cold: [
    "Warm coat",
    "Thermal base layers",
    "Wool sweater",
    "Gloves",
    "Beanie",
    "Scarf",
    "Wool socks",
    "Insulated boots",
  ],
  mild: [
    "Light jacket",
    "Long-sleeve shirts",
    "Jeans",
    "Versatile layers",
    "Light scarf",
    "Comfortable walking shoes",
  ],
  hot: [
    "Breathable t-shirts",
    "Shorts",
    "Sunhat",
    "Sunglasses",
    "Swimsuit",
    "Sandals",
    "Light linen shirt",
  ],
};

const DOCS_ITEMS = [
  "Passport",
  "Boarding pass (PDF)",
  "Travel insurance info",
  "Hotel confirmation",
];
const TECH_ITEMS = [
  "Phone charger",
  "Power adapter",
  "Portable battery pack",
  "Headphones",
];
const TOILETRIES_ITEMS = [
  "Toothbrush & toothpaste",
  "Sunscreen",
  "Basic first-aid kit",
  "Travel-size shampoo",
];

async function nextSortOrder(tripId: string): Promise<number> {
  const db = await getDb();
  const existing = await db
    .select({ sortOrder: schema.packingItems.sortOrder })
    .from(schema.packingItems)
    .where(eq(schema.packingItems.tripId, tripId));
  return existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
}

/** Auto-generates a starter list from destination climate + trip length (QA 7.7). */
export async function generateStarterPackingList(
  userId: string,
  tripId: string,
): Promise<PackingItemRow[]> {
  const trip = await getTrip(userId, tripId); // ownership check
  const context = await getOutboundFlightContext(userId, tripId);
  const lat = context?.destLat ?? 20; // fallback: mild/tropical default
  const month = trip.startDate.getUTCMonth() + 1;
  const band = climateBandFor(lat, month);
  const days = tripLengthDays(trip);

  const rand = seededRandom(hashSeed(`packing:${tripId}`));
  const wardrobe = [...CLOTHING_BY_BAND[band]];
  const clothingCount = Math.min(wardrobe.length, 3 + Math.floor(rand() * 2));

  const items: { label: string; category: string }[] = [];
  for (let i = 0; i < clothingCount; i++) {
    const index = randInt(rand, 0, wardrobe.length - 1);
    items.push({ label: wardrobe.splice(index, 1)[0], category: "clothing" });
  }
  items.push({ label: `${days}× underwear`, category: "clothing" });
  items.push({ label: `${Math.max(Math.ceil(days / 2), 1)}× socks`, category: "clothing" });
  for (const label of DOCS_ITEMS) items.push({ label, category: "docs" });
  for (const label of TECH_ITEMS) items.push({ label, category: "tech" });
  for (const label of TOILETRIES_ITEMS) items.push({ label, category: "toiletries" });

  const db = await getDb();
  const startOrder = await nextSortOrder(tripId);
  return db
    .insert(schema.packingItems)
    .values(
      items.map((item, index) => ({
        tripId,
        label: item.label,
        category: item.category,
        isChecked: false,
        sortOrder: startOrder + index,
        isAuto: true,
      })),
    )
    .returning();
}

export async function listPackingItems(
  userId: string,
  tripId: string,
): Promise<PackingItemRow[]> {
  await getTrip(userId, tripId); // ownership check
  const db = await getDb();
  return db
    .select()
    .from(schema.packingItems)
    .where(eq(schema.packingItems.tripId, tripId))
    .orderBy(asc(schema.packingItems.sortOrder));
}

async function getOwnedPackingItem(
  userId: string,
  itemId: string,
): Promise<PackingItemRow> {
  const db = await getDb();
  const [item] = await db
    .select()
    .from(schema.packingItems)
    .where(eq(schema.packingItems.id, itemId))
    .limit(1);
  if (!item) throw new OwnershipError();
  await getTrip(userId, item.tripId); // ownership check
  return item;
}

export async function toggleChecked(userId: string, itemId: string): Promise<void> {
  const item = await getOwnedPackingItem(userId, itemId);
  const db = await getDb();
  await db
    .update(schema.packingItems)
    .set({ isChecked: !item.isChecked })
    .where(eq(schema.packingItems.id, itemId));
}

export async function addCustomItem(
  userId: string,
  tripId: string,
  label: string,
  category: string,
): Promise<PackingItemRow> {
  await getTrip(userId, tripId); // ownership check
  const db = await getDb();
  const sortOrder = await nextSortOrder(tripId);
  const [row] = await db
    .insert(schema.packingItems)
    .values({ tripId, label, category, isChecked: false, sortOrder, isAuto: false })
    .returning();
  return row;
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  await getOwnedPackingItem(userId, itemId);
  const db = await getDb();
  await db.delete(schema.packingItems).where(eq(schema.packingItems.id, itemId));
}

/** Drops the auto-generated rows and regenerates them; custom rows survive. */
export async function resetToAuto(
  userId: string,
  tripId: string,
): Promise<PackingItemRow[]> {
  await getTrip(userId, tripId); // ownership check
  const db = await getDb();
  await db
    .delete(schema.packingItems)
    .where(
      and(eq(schema.packingItems.tripId, tripId), eq(schema.packingItems.isAuto, true)),
    );
  return generateStarterPackingList(userId, tripId);
}
