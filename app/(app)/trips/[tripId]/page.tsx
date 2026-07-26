import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import {
  getOutboundFlightContext,
  getStampForTrip,
  getTripSavingsCents,
  statusOf,
} from "@/lib/services/trips";
import { assertCanView } from "@/lib/services/access";
import { listCollaborators, listShares } from "@/lib/services/shares";
import { OwnershipError } from "@/lib/services/ownership";
import { currentTimeMs, isDepartureDay } from "@/lib/countdown";
import { formatDateInTz, formatMoney } from "@/lib/format";
import { DestinationArt } from "@/components/destination-art";
import { CountdownFlip } from "@/components/countdown-flip";
import { PassportStamp } from "@/components/passport-stamp";
import { CollaboratorAvatars } from "@/components/collaborator-avatars";
import { ShareSheet } from "@/components/share-sheet";
import { AddToCalendarButton } from "@/components/add-to-calendar-button";

/*
 * Trip detail (WF §13): hero, live countdown, facts, links out to the
 * boarding pass and passport stamp. Collaborator avatars shown when the
 * trip is shared (owner only). Share/Add-to-calendar buttons join this
 * header in components/share-sheet.tsx + components/add-to-calendar-button.tsx.
 *
 * Phase 9 access: `assertCanView` admits owner, editor, and viewer
 * collaborators — but bookings/passport/savings/packing/Explore stay
 * strictly owner-only (golden rule #10: collaborators touch ONLY
 * itinerary_items), so every owner-only fetch and link below is gated on
 * `access.role === "owner"`.
 *
 * Past-dated guard (task 6): a trip already in its "memory" status never
 * reaches CountdownFlip at all — remainingUntil's own zero-clamp is a second
 * defensive layer, but the page-level branch below is what actually
 * prevents ever constructing the countdown with a stale target.
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

  let access;
  try {
    access = await assertCanView(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }
  const { trip, role } = access;
  const isOwner = role === "owner";

  const nowMs = currentTimeMs();
  const status = statusOf(trip, new Date(nowMs));
  const [flightContext, stamp, savingsCents, collaborators, shares] = await Promise.all([
    isOwner ? getOutboundFlightContext(userId, tripId) : Promise.resolve(null),
    isOwner ? getStampForTrip(userId, tripId) : Promise.resolve(null),
    isOwner ? getTripSavingsCents(userId, tripId) : Promise.resolve(null),
    isOwner ? listCollaborators(userId, tripId) : Promise.resolve([]),
    isOwner ? listShares(userId, tripId) : Promise.resolve([]),
  ]);

  const originTz = flightContext?.originTz ?? "UTC";
  const departureDay = isDepartureDay(nowMs, trip.startDate.getTime(), originTz);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s6">
      <DestinationArt
        seed={trip.coverSeed}
        size={640}
        className="aspect-[16/9] w-full rounded-lg"
      />

      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          {trip.destinationCity}
          {trip.destinationCountry ? `, ${trip.destinationCountry}` : ""}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-s3">
          <h1 className="font-display text-3xl">{trip.title}</h1>
          {isOwner && collaborators.length > 0 ? (
            <CollaboratorAvatars collaborators={collaborators} />
          ) : null}
        </div>
        <p className="text-sm text-ink-soft">
          {formatDateInTz(trip.startDate.getTime(), originTz)} –{" "}
          {formatDateInTz(trip.endDate.getTime(), originTz)}
        </p>
        {!isOwner ? (
          <p
            data-testid="collaborator-role-note"
            className="text-sm text-ink-soft"
          >
            You&apos;re {role === "editor" ? "helping plan" : "viewing"} this
            trip as a collaborator.
          </p>
        ) : null}
      </header>

      {status === "upcoming" ? (
        <div className="ticket-surface flex flex-col items-center gap-s3 p-s5">
          <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">
            Departing in
          </p>
          <CountdownFlip
            targetUtcMs={trip.startDate.getTime()}
            initialNowUtcMs={nowMs}
          />
        </div>
      ) : null}

      {status === "in_progress" && departureDay ? (
        <div
          data-testid="bon-voyage"
          className="ticket-surface flex flex-col items-center gap-s2 p-s5 text-center"
        >
          <p className="font-display text-2xl">Bon voyage!</p>
          <p className="text-sm text-ink-soft">
            Today&apos;s the day — enjoy the (pretend) trip.
          </p>
        </div>
      ) : null}

      {status === "in_progress" && !departureDay ? (
        <div
          data-testid="trip-in-progress"
          className="ticket-surface flex flex-col items-center gap-s2 p-s5 text-center"
        >
          <p className="font-display text-xl">Somewhere out there, dreaming…</p>
          <p className="text-sm text-ink-soft">Your pretend trip is underway.</p>
        </div>
      ) : null}

      {status === "memory" ? (
        <div
          data-testid="trip-memory"
          className="ticket-surface flex flex-col items-center gap-s3 p-s5 text-center"
        >
          <p className="font-display text-xl">This trip is complete</p>
          <p className="text-sm text-ink-soft">
            Your Trip Memories are ready — the recap, the postcard, and the
            passport stamp all live there now.
          </p>
          <Link
            href={`/trips/${trip.id}/memories`}
            className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
          >
            View Trip Memories
          </Link>
        </div>
      ) : null}

      {stamp ? (
        <div className="ticket-surface flex items-center gap-s4 p-s5">
          <PassportStamp
            stampStyle={stamp.stampStyle}
            rotationDeg={stamp.rotationDeg}
            inkHue={stamp.inkHue}
            city={stamp.city}
            countryIso={stamp.countryIso}
            dateLabel={formatDateInTz(stamp.stampDate.getTime(), originTz)}
            size={80}
          />
          <div className="flex flex-col gap-1">
            <p className="font-display text-lg">Passport stamp earned</p>
            <Link
              href="/passport"
              className="text-sm font-semibold text-horizon-deep underline"
            >
              View your passport
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-s3">
        {isOwner && flightContext ? (
          <Link
            href={`/trip/confirmation/${flightContext.bookingId}`}
            className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
          >
            Boarding pass
          </Link>
        ) : null}
        {isOwner ? (
          <Link
            href="/passport"
            className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
          >
            Passport
          </Link>
        ) : null}
        <Link
          href={`/trips/${trip.id}/itinerary`}
          className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Itinerary
        </Link>
        {isOwner ? (
          <Link
            href={`/trips/${trip.id}/packing`}
            className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
          >
            Packing
          </Link>
        ) : null}
        {isOwner ? (
          <Link
            href={`/trips/${trip.id}/explore`}
            className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
          >
            Explore {trip.destinationCity}
          </Link>
        ) : null}
        {isOwner ? <ShareSheet tripId={trip.id} initialShares={shares} initialCollaborators={collaborators} /> : null}
        <AddToCalendarButton tripId={trip.id} />
      </div>

      {isOwner && savingsCents !== null ? (
        <p className="text-sm text-ink-soft">
          You saved{" "}
          <span className="font-mono font-bold text-mint-ok">
            {formatMoney(savingsCents)}
          </span>{" "}
          on this pretend trip — every price here is $0.00, always.
        </p>
      ) : null}
    </section>
  );
}
