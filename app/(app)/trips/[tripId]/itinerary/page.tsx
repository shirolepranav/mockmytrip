import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getOutboundFlightContext, getTrip } from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { listItineraryItems, tripLengthDays } from "@/lib/services/itinerary";
import { formatDateInTz } from "@/lib/format";
import { ItineraryBoard } from "@/components/itinerary-board";

/* Itinerary builder (WF §14): day columns seeded from the trip's own dates. */

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

  let trip;
  try {
    trip = await getTrip(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }

  const [items, flightContext] = await Promise.all([
    listItineraryItems(userId, tripId),
    getOutboundFlightContext(userId, tripId),
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
        <Link
          href={`/trips/${tripId}/itinerary/print`}
          data-testid="itinerary-export-link"
          className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Export itinerary
        </Link>
      </header>

      <ItineraryBoard
        tripId={tripId}
        destinationCity={trip.destinationCity}
        initialItems={items}
        dayCount={dayCount}
        dayLabels={dayLabels}
      />
    </section>
  );
}
