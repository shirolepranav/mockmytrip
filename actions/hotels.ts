"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { establishSession, readSessionUserId } from "@/lib/auth/session";
import { getOrCreateGuest } from "@/lib/services/users";
import { getDraft, saveDraft } from "@/lib/services/trips";
import { hotelOfferViewSchema } from "@/lib/hotel-offer-view";

/*
 * Thin wrappers over lib/services/trips (no business logic here), mirroring
 * actions/trips.ts's selectFlightAction.
 */

const selectHotelSchema = z.object({
  offer: hotelOfferViewSchema,
  search: z.object({
    city: z.string(),
    country: z.string(),
    checkin: z.string(),
    checkout: z.string(),
    guests: z.number(),
    rooms: z.number(),
  }),
});

export async function selectHotelAction(formData: FormData): Promise<void> {
  const parsed = selectHotelSchema.parse(
    JSON.parse(String(formData.get("payload"))),
  );

  const existing = await readSessionUserId();
  const user = await getOrCreateGuest(existing);
  await establishSession(user.id);

  const draft = (await getDraft(user.id)) ?? {};
  draft.hotel = parsed.offer;
  draft.hotelSearch = parsed.search;
  await saveDraft(user.id, draft);

  redirect("/trip/summary");
}

/**
 * "Skip hotels" (WF §6, QA 4.7): explicitly clears any stale hotel pick so a
 * previously-selected hotel can't silently reappear after a conscious skip.
 */
export async function skipHotelAction(): Promise<void> {
  const userId = await readSessionUserId();
  if (userId) {
    const draft = (await getDraft(userId)) ?? {};
    delete draft.hotel;
    delete draft.hotelSearch;
    await saveDraft(userId, draft);
  }
  redirect("/trip/summary");
}
