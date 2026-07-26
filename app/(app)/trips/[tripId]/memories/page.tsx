import Link from "next/link";
import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import {
  getOutboundFlightContext,
  getStampForTrip,
  getTrip,
  getTripSavingsCents,
  statusOf,
} from "@/lib/services/trips";
import { tripLengthDays } from "@/lib/services/itinerary";
import { OwnershipError } from "@/lib/services/ownership";
import { currentTimeMs } from "@/lib/countdown";
import { formatDateInTz } from "@/lib/format";
import { MemoriesUnlockWatcher } from "@/components/memories-unlock-watcher";
import { MemoryPostcard } from "@/components/memory-postcard";
import { MemoryNoteField } from "@/components/memory-note-field";
import { MemoryAiButton } from "@/components/memory-ai-button";
import { PostcardShareButton } from "@/components/postcard-share-button";

/*
 * Trip Memories (Phase 8 task 5, WF §17): locked before the fake end date,
 * unlocked recap after. The unlocked postcard is composed entirely from
 * existing reads (getStampForTrip, getTripSavingsCents,
 * getOutboundFlightContext) — no new computation, no new tables.
 */

export const metadata = { title: "Trip Memories" };

export default async function MemoriesPage({
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

  const nowMs = currentTimeMs();
  const status = statusOf(trip, new Date(nowMs));
  const flightContext = await getOutboundFlightContext(userId, tripId);
  const originTz = flightContext?.originTz ?? "UTC";

  if (status !== "memory") {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-s4 text-center">
        <MemoriesUnlockWatcher endDateMs={trip.endDate.getTime()} initialNowMs={nowMs} />
        <h1 className="font-display text-2xl">Trip Memories</h1>
        <div
          data-testid="memories-locked"
          className="ticket-surface flex flex-col items-center gap-s2 p-s5"
        >
          <p className="font-display text-lg">Still ahead of you</p>
          <p className="text-sm text-ink-soft">
            Your memories unlock on{" "}
            {formatDateInTz(trip.endDate.getTime(), originTz)} — once the
            (pretend) trip is over.
          </p>
        </div>
        <Link
          href={`/trips/${tripId}`}
          className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Back to trip
        </Link>
      </section>
    );
  }

  const [stampRow, savingsCents] = await Promise.all([
    getStampForTrip(userId, tripId),
    getTripSavingsCents(userId, tripId),
  ]);
  const dateRangeLabel = `${formatDateInTz(trip.startDate.getTime(), originTz)} – ${formatDateInTz(trip.endDate.getTime(), originTz)}`;
  const stamp = stampRow
    ? {
        stampStyle: stampRow.stampStyle,
        rotationDeg: stampRow.rotationDeg,
        inkHue: stampRow.inkHue,
        city: stampRow.city,
        countryIso: stampRow.countryIso,
        dateLabel: formatDateInTz(stampRow.stampDate.getTime(), originTz),
      }
    : null;

  return (
    <section
      data-testid="memories-unlocked"
      className="mx-auto flex w-full max-w-2xl flex-col gap-s6"
    >
      <header className="flex flex-col gap-s1 text-center">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Trip Memories
        </p>
        <h1 className="font-display text-2xl">{trip.title}</h1>
      </header>

      <MemoryPostcard
        coverSeed={trip.coverSeed}
        destinationCity={trip.destinationCity}
        destinationCountry={trip.destinationCountry}
        originCity={flightContext?.originCity ?? null}
        dateRangeLabel={dateRangeLabel}
        distanceKm={stampRow?.distanceKm ?? 0}
        savingsCents={savingsCents}
        stamp={stamp}
      />

      <div className="ticket-surface flex flex-col gap-s4 p-s5">
        <h2 className="font-display text-lg">Write it down</h2>
        <MemoryAiButton
          tripId={tripId}
          city={trip.destinationCity}
          days={tripLengthDays(trip)}
        />
        <MemoryNoteField tripId={tripId} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-s3">
        <PostcardShareButton destinationCity={trip.destinationCity} />
        <Link
          href={`/trips/${tripId}`}
          className="press-physical inline-flex min-h-11 items-center rounded-pill border border-line px-s5 font-semibold text-ink"
        >
          Back to trip
        </Link>
      </div>
    </section>
  );
}
