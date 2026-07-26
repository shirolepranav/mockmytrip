import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getOutboundFlightContext } from "@/lib/services/trips";
import { assertCanView } from "@/lib/services/access";
import { listCollaboratorNamesForViewer } from "@/lib/services/shares";
import { OwnershipError } from "@/lib/services/ownership";
import { listItineraryItems, tripLengthDays } from "@/lib/services/itinerary";
import { formatDateInTz } from "@/lib/format";
import { ItineraryBoard } from "@/components/itinerary-board";

/*
 * Itinerary builder (WF §14): day columns seeded from the trip's own dates.
 * Phase 9: this is the SAME route a collaborator lands on (task 6 — "the
 * shared page and owner's itinerary" both edit through here, not a
 * separate collaborator-only route). `assertCanView` admits owner/editor/
 * viewer; ItineraryBoard's own `canEdit` prop then hides mutation
 * affordances for a viewer.
 */

export const metadata = { title: "Itinerary" };

const DAY_MS = 86_400_000;

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const userId = await readSessionUserId();
  if (!userId) notFound();

  let access;
  try {
    access = await assertCanView(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }
  const { trip, role } = access;
  const isOwner = role === "owner";

  const [items, flightContext, collaboratorNames] = await Promise.all([
    listItineraryItems(userId, tripId),
    // Flight/booking detail stays owner-only (golden rule #10) — a
    // collaborator's day labels fall back to UTC dates rather than the
    // destination's local dates, a minor, acceptable simplification.
    isOwner ? getOutboundFlightContext(userId, tripId) : Promise.resolve(null),
    listCollaboratorNamesForViewer(userId, tripId),
  ]);
  const tz = flightContext?.originTz ?? "UTC";
  const dayCount = tripLengthDays(trip);
  const dayLabels = Array.from({ length: dayCount }, (_, index) =>
    formatDateInTz(trip.startDate.getTime() + index * DAY_MS, tz),
  );

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-wrap items-center justify-between gap-s3">
        <div className="flex flex-col gap-s2">
          <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
            {trip.destinationCity}
          </p>
          <h1 className="font-display text-2xl">{trip.title} — Itinerary</h1>
        </div>
        {isOwner ? (
          <Link
            href={`/trips/${tripId}/itinerary/print`}
            data-testid="itinerary-export-link"
            className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
          >
            Export itinerary
          </Link>
        ) : null}
      </header>

      <ItineraryBoard
        tripId={tripId}
        destinationCity={trip.destinationCity}
        initialItems={items}
        dayCount={dayCount}
        dayLabels={dayLabels}
        currentUserId={userId}
        canEdit={role !== "viewer"}
        ownerUserId={trip.userId}
        collaboratorNames={collaboratorNames}
      />
    </section>
  );
}
