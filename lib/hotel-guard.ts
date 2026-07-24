import { redirect } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getDraft, type TripDraft } from "@/lib/services/trips";
import { flightOfferViewSchema } from "@/lib/offer-view";

/*
 * Hotels only make sense once a flight is chosen (WF §6/§9, IMPLEMENTATION
 * PLAN Phase 4 task 6): "hotel-only" is not allowed. This guard covers both
 * that rule and the "direct-nav to /trip/summary with an empty draft" case
 * (QA 4.8) with one implementation, used by every hotel/summary page.
 */

export async function requireFlightDraft(): Promise<TripDraft> {
  const userId = await readSessionUserId();
  const draft = userId ? await getDraft(userId) : null;
  const parsed = flightOfferViewSchema.safeParse(draft?.flight);
  if (!parsed.success) {
    redirect("/search/flights?notice=need-flight");
  }
  return draft!;
}
