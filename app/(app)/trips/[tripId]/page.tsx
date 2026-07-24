import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import {
  getOutboundFlightForTrip,
  getStampForTrip,
  getTrip,
  statusOf,
} from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { byIata } from "@/lib/engine/airports";
import { DestinationArt } from "@/components/destination-art";
import { CountdownFlip } from "@/components/countdown-flip";
import { TripMemoryBanner } from "@/components/trip-memory-banner";
import { formatDateInTz } from "@/lib/format";

/*
 * Trip detail (WF §13, Phase 6 task 3): seeded hero, CountdownFlip, facts,
 * links to boarding pass / passport stamp, and disabled "coming soon"
 * placeholders for Itinerary/Packing (not built until Phase 7 — these are
 * inert <span>s with no href, never broken links to a not-yet-built route).
 */

export const metadata = { title: "Trip detail" };

export default async function TripDetailPage({
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

  const now = new Date();
  const status = statusOf(trip, now);

  // Past-dated guard (WF §13 edge case): a trip already past on load skips
  // straight to the Memory state — CountdownFlip is never constructed or
  // mounted here, which is what makes a negative countdown structurally
  // impossible rather than merely unlikely.
  if (status === "memory") {
    return <TripMemoryBanner trip={trip} />;
  }

  const [outbound, stamp] = await Promise.all([
    getOutboundFlightForTrip(userId, tripId),
    getStampForTrip(userId, tripId),
  ]);
  const origin = outbound ? byIata(outbound.originIata) : undefined;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s5">
      <DestinationArt
        seed={trip.coverSeed}
        size={640}
        className="aspect-video w-full overflow-hidden rounded-card [&_svg]:h-full [&_svg]:w-full"
      />

      <header className="flex flex-col gap-s1">
        <h1 className="font-display text-2xl">{trip.title}</h1>
        <p className="text-ink-soft">
          {trip.destinationCity}
          {trip.destinationCountry ? `, ${trip.destinationCountry}` : ""} ·{" "}
          {formatDateInTz(trip.startDate.getTime(), "UTC")} –{" "}
          {formatDateInTz(trip.endDate.getTime(), "UTC")}
        </p>
      </header>

      {/* Defensive: every real trip has a flight leg, but this never
          renders a broken countdown if one is somehow missing. */}
      {outbound && origin ? (
        <CountdownFlip
          targetUtcMs={outbound.departAt.getTime()}
          endUtcMs={trip.endDate.getTime()}
          originTz={origin.tz}
          destinationCity={trip.destinationCity}
          nowUtcMs={now.getTime()}
        />
      ) : null}

      <nav
        aria-label="Trip links"
        className="flex flex-wrap items-center gap-s3"
      >
        {outbound ? (
          <Link
            href={`/trip/confirmation/${outbound.bookingId}`}
            data-testid="trip-detail-boarding-pass-link"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s4 font-semibold text-ink"
          >
            Boarding pass
          </Link>
        ) : null}
        {stamp ? (
          <Link
            href="/passport"
            data-testid="trip-detail-passport-link"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s4 font-semibold text-ink"
          >
            Passport stamp
          </Link>
        ) : null}
        <span
          aria-disabled="true"
          data-testid="trip-detail-itinerary-placeholder"
          className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-pill border border-line px-s4 font-semibold text-ink-soft opacity-50"
        >
          Itinerary — coming soon
        </span>
        <span
          aria-disabled="true"
          data-testid="trip-detail-packing-placeholder"
          className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-pill border border-line px-s4 font-semibold text-ink-soft opacity-50"
        >
          Packing — coming soon
        </span>
      </nav>
    </section>
  );
}
