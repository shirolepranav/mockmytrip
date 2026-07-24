"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { establishSession, readSessionUserId } from "@/lib/auth/session";
import { getOrCreateGuest } from "@/lib/services/users";
import {
  deleteTrip,
  getDraft,
  renameTrip,
  saveDraft,
} from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { flightOfferViewSchema } from "@/lib/offer-view";

/*
 * Thin wrappers over lib/services/trips (no business logic here).
 */

const selectFlightSchema = z.object({
  offer: flightOfferViewSchema,
  leg: z.enum(["outbound", "return"]),
  search: z.object({
    o: z.string(),
    d: z.string(),
    depart: z.string(),
    return: z.string().optional(),
    pax: z.number(),
    cabin: z.string(),
  }),
});

export async function selectFlightAction(formData: FormData): Promise<void> {
  const parsed = selectFlightSchema.parse(
    JSON.parse(String(formData.get("payload"))),
  );

  const existing = await readSessionUserId();
  const user = await getOrCreateGuest(existing);
  await establishSession(user.id);

  const draft = (await getDraft(user.id)) ?? {};
  if (parsed.leg === "return") {
    draft.returnFlight = parsed.offer;
  } else {
    draft.flight = parsed.offer;
    delete draft.returnFlight; // new outbound invalidates an old return
  }
  draft.search = parsed.search;
  await saveDraft(user.id, draft);

  // Round trip with the outbound just chosen → pick the return leg next.
  if (parsed.leg === "outbound" && parsed.search.return) {
    const query = new URLSearchParams({
      o: parsed.search.o,
      d: parsed.search.d,
      depart: parsed.search.depart,
      return: parsed.search.return,
      pax: String(parsed.search.pax),
      cabin: parsed.search.cabin,
      leg: "return",
    });
    redirect(`/search/flights/results?${query.toString()}`);
  }
  redirect("/search/hotels");
}

const updateTitleSchema = z.object({ title: z.string().trim().min(1).max(120) });

/** Editable auto-title on the trip summary (WF §9, QA 4.9) — persists to the draft. */
export async function updateDraftTitleAction(formData: FormData): Promise<void> {
  const parsed = updateTitleSchema.safeParse({
    title: String(formData.get("title") ?? ""),
  });

  const userId = await readSessionUserId();
  if (userId && parsed.success) {
    const draft = (await getDraft(userId)) ?? {};
    draft.title = parsed.data.title;
    await saveDraft(userId, draft);
  }
  redirect("/trip/summary");
}

const renameTripSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

/** Dashboard overflow → Rename (WF §12). Stays on /trips — an in-place list
 *  mutation, not a wizard step. */
export async function renameTripAction(formData: FormData): Promise<void> {
  const parsed = renameTripSchema.safeParse({
    tripId: String(formData.get("tripId") ?? ""),
    title: String(formData.get("title") ?? ""),
  });
  const userId = await readSessionUserId();
  if (userId && parsed.success) {
    try {
      await renameTrip(userId, parsed.data.tripId, parsed.data.title);
    } catch (error) {
      // Forged/foreign tripId → silent no-op, no info leak.
      if (!(error instanceof OwnershipError)) throw error;
    }
  }
  revalidatePath("/trips");
}

const deleteTripSchema = z.object({ tripId: z.string().uuid() });

/** Dashboard overflow → Delete (WF §12, plain confirm already performed
 *  client-side by TripCardMenu — no confirm-shaming, golden rule #3). */
export async function deleteTripAction(formData: FormData): Promise<void> {
  const parsed = deleteTripSchema.safeParse({
    tripId: String(formData.get("tripId") ?? ""),
  });
  const userId = await readSessionUserId();
  if (userId && parsed.success) {
    try {
      await deleteTrip(userId, parsed.data.tripId);
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
    }
  }
  revalidatePath("/trips");
}
