"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { establishSession, readSessionUserId } from "@/lib/auth/session";
import { getOrCreateGuest } from "@/lib/services/users";
import { getDraft, saveDraft } from "@/lib/services/trips";

/*
 * Thin wrappers over lib/services/trips (no business logic here).
 */

const offerViewSchema = z.object({
  id: z.string(),
  airlineName: z.string(),
  airlineCode: z.string(),
  airlineHue: z.number(),
  airlineLogoSeed: z.number(),
  flightNumber: z.string(),
  originIata: z.string(),
  originCity: z.string(),
  originCountry: z.string(),
  originTz: z.string(),
  destIata: z.string(),
  destCity: z.string(),
  destCountry: z.string(),
  destTz: z.string(),
  departUtcMs: z.number(),
  arriveUtcMs: z.number(),
  durationMin: z.number(),
  distanceKm: z.number(),
  stops: z.array(
    z.object({
      hubIata: z.string(),
      hubCity: z.string(),
      layoverMin: z.number(),
    }),
  ),
  cabin: z.string(),
  passengers: z.number(),
  priceCents: z.number(),
  savedCents: z.number(),
  seed: z.number(),
});

const selectFlightSchema = z.object({
  offer: offerViewSchema,
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
