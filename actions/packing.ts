"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readSessionUserId } from "@/lib/auth/session";
import {
  addCustomItem,
  deleteItem,
  generateStarterPackingList,
  resetToAuto,
  toggleChecked,
  type PackingItemRow,
} from "@/lib/services/packing";
import { OwnershipError } from "@/lib/services/ownership";

/* Thin wrappers over lib/services/packing (no business logic here). */

async function guardOwnership<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof OwnershipError) return null;
    throw error;
  }
}

const tripSchema = z.object({ tripId: z.string().uuid() });

export async function generateStarterPackingListAction(
  input: z.infer<typeof tripSchema>,
): Promise<PackingItemRow[] | null> {
  const parsed = tripSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return null;
  const items = await guardOwnership(() =>
    generateStarterPackingList(userId, parsed.tripId),
  );
  revalidatePath(`/trips/${parsed.tripId}/packing`);
  return items;
}

const toggleSchema = z.object({ itemId: z.string().uuid(), tripId: z.string().uuid() });

export async function toggleCheckedAction(
  input: z.infer<typeof toggleSchema>,
): Promise<void> {
  const parsed = toggleSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await guardOwnership(() => toggleChecked(userId, parsed.itemId));
  revalidatePath(`/trips/${parsed.tripId}/packing`);
}

const addSchema = z.object({
  tripId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40).default("misc"),
});

export async function addCustomItemAction(
  input: z.infer<typeof addSchema>,
): Promise<PackingItemRow | null> {
  const parsed = addSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return null;
  const item = await guardOwnership(() =>
    addCustomItem(userId, parsed.tripId, parsed.label, parsed.category),
  );
  revalidatePath(`/trips/${parsed.tripId}/packing`);
  return item;
}

const deleteSchema = z.object({ itemId: z.string().uuid(), tripId: z.string().uuid() });

export async function deletePackingItemAction(
  input: z.infer<typeof deleteSchema>,
): Promise<void> {
  const parsed = deleteSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return;
  await guardOwnership(() => deleteItem(userId, parsed.itemId));
  revalidatePath(`/trips/${parsed.tripId}/packing`);
}

export async function resetToAutoAction(
  input: z.infer<typeof tripSchema>,
): Promise<PackingItemRow[] | null> {
  const parsed = tripSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return null;
  const items = await guardOwnership(() => resetToAuto(userId, parsed.tripId));
  revalidatePath(`/trips/${parsed.tripId}/packing`);
  return items;
}
