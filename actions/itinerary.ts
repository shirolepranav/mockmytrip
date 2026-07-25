"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readSessionUserId } from "@/lib/auth/session";
import {
  addItineraryItem,
  deleteItineraryItem,
  reorderItineraryItems,
  updateItineraryItem,
  type ItineraryItemRow,
} from "@/lib/services/itinerary";
import { OwnershipError } from "@/lib/services/ownership";

/*
 * Thin wrappers over lib/services/itinerary (no business logic here). Called
 * directly from client components (not <form action>) since the itinerary
 * board is drag/optimistic-driven — TECH_SPEC §3 explicitly calls for
 * useOptimistic here, which needs a plain async function to await.
 */

async function guardOwnership<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof OwnershipError) return null;
    throw error;
  }
}

const categorySchema = z.enum(["food", "sight", "activity", "transit", "rest"]);

const addSchema = z.object({
  tripId: z.string().uuid(),
  dayIndex: z.number().int().min(0),
  time: z.string().max(5).optional(),
  title: z.string().trim().min(1).max(120),
  note: z.string().max(280).optional(),
  category: categorySchema,
  poiId: z.string().uuid().optional(),
});

export async function addItineraryItemAction(
  input: z.infer<typeof addSchema>,
): Promise<ItineraryItemRow | null> {
  const parsed = addSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return null;
  const item = await guardOwnership(() =>
    addItineraryItem(userId, parsed.tripId, parsed),
  );
  revalidatePath(`/trips/${parsed.tripId}/itinerary`);
  return item;
}

const updateSchema = z.object({
  itemId: z.string().uuid(),
  tripId: z.string().uuid(),
  time: z.string().max(5).nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  note: z.string().max(280).nullable().optional(),
  category: categorySchema.optional(),
});

export async function updateItineraryItemAction(
  input: z.infer<typeof updateSchema>,
): Promise<void> {
  const parsed = updateSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await guardOwnership(() =>
    updateItineraryItem(userId, parsed.itemId, {
      time: parsed.time,
      title: parsed.title,
      note: parsed.note,
      category: parsed.category,
    }),
  );
  revalidatePath(`/trips/${parsed.tripId}/itinerary`);
}

const deleteSchema = z.object({
  itemId: z.string().uuid(),
  tripId: z.string().uuid(),
});

export async function deleteItineraryItemAction(
  input: z.infer<typeof deleteSchema>,
): Promise<void> {
  const parsed = deleteSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await guardOwnership(() => deleteItineraryItem(userId, parsed.itemId));
  revalidatePath(`/trips/${parsed.tripId}/itinerary`);
}

const moveSchema = z.object({
  itemId: z.string().uuid(),
  dayIndex: z.number().int().min(0),
  sortOrder: z.number().int().min(0),
});
const reorderSchema = z.object({
  tripId: z.string().uuid(),
  moves: z.array(moveSchema).min(1),
});

export async function reorderItineraryItemsAction(
  input: z.infer<typeof reorderSchema>,
): Promise<void> {
  const parsed = reorderSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await guardOwnership(() =>
    reorderItineraryItems(userId, parsed.tripId, parsed.moves),
  );
  revalidatePath(`/trips/${parsed.tripId}/itinerary`);
}
