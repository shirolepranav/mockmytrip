"use server";

import { z } from "zod";
import { readSessionUserId } from "@/lib/auth/session";
import {
  AiQuotaExceededError,
  AiUnavailableError,
  suggestItinerary,
  suggestMemory,
  type ItinerarySuggestion,
} from "@/lib/services/ai";
import { OwnershipError } from "@/lib/services/ownership";

/* Thin wrapper over lib/services/ai — maps every failure mode to a friendly,
   typed result so the itinerary UI never sees an unhandled throw. */

const inputSchema = z.object({
  tripId: z.string().uuid(),
  city: z.string().trim().min(1).max(120),
  days: z.number().int().min(1).max(60),
  interests: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
});

export interface SuggestItineraryResult {
  status: "ok" | "quota" | "unavailable" | "signed_out";
  items?: ItinerarySuggestion["items"];
  message?: string;
}

const QUOTA_MESSAGE =
  "You've used today's AI suggestions — try again tomorrow, or add items yourself.";

export async function suggestItineraryAction(
  input: z.infer<typeof inputSchema>,
): Promise<SuggestItineraryResult> {
  const parsed = inputSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return { status: "signed_out" };

  try {
    const suggestion = await suggestItinerary(
      userId,
      parsed.tripId,
      parsed.city,
      parsed.days,
      parsed.interests,
    );
    return { status: "ok", items: suggestion.items };
  } catch (error) {
    if (error instanceof AiQuotaExceededError) {
      return { status: "quota", message: QUOTA_MESSAGE };
    }
    if (error instanceof AiUnavailableError || error instanceof OwnershipError) {
      return { status: "unavailable", message: error.message };
    }
    throw error;
  }
}

const memoryInputSchema = z.object({
  tripId: z.string().uuid(),
  city: z.string().trim().min(1).max(120),
  days: z.number().int().min(1).max(60),
});

export interface SuggestMemoryResult {
  status: "ok" | "quota" | "unavailable" | "signed_out";
  paragraph?: string;
  message?: string;
}

export async function suggestMemoryAction(
  input: z.infer<typeof memoryInputSchema>,
): Promise<SuggestMemoryResult> {
  const parsed = memoryInputSchema.parse(input);
  const userId = await readSessionUserId();
  if (!userId) return { status: "signed_out" };

  try {
    const suggestion = await suggestMemory(userId, parsed.tripId, parsed.city, parsed.days);
    return { status: "ok", paragraph: suggestion.paragraph };
  } catch (error) {
    if (error instanceof AiQuotaExceededError) {
      return { status: "quota", message: QUOTA_MESSAGE };
    }
    if (error instanceof AiUnavailableError || error instanceof OwnershipError) {
      return { status: "unavailable", message: error.message };
    }
    throw error;
  }
}
