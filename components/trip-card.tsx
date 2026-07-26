import Link from "next/link";
import { DestinationArt } from "@/components/destination-art";
import { TripCardMenu } from "@/components/trip-card-menu";
import { remainingUntil } from "@/lib/countdown";
import type { TripRow, TripStatus } from "@/lib/services/trips";

/** A short "in Xd"/"in Xh"/"today" chip — the full split-flap lives on Trip Detail. */
function miniCountdownLabel(
  trip: TripRow,
  status: TripStatus,
  nowMs: number,
): string | null {
  if (status !== "upcoming") return null;
  const { days, hours } = remainingUntil(trip.startDate.getTime(), nowMs);
  if (days > 0) return `in ${days}d`;
  if (hours > 0) return `in ${hours}h`;
  return "today";
}

export function TripCard({
  trip,
  status,
  nowMs,
  sharedByLabel,
  showOwnerMenu = true,
}: {
  trip: TripRow;
  status: TripStatus;
  nowMs: number;
  /** "Shared by {name}" badge — set for a trip this user collaborates on, not owns (Phase 9). */
  sharedByLabel?: string | null;
  /** False for a collaborated-on trip — rename/delete belong to the owner only. */
  showOwnerMenu?: boolean;
}) {
  const chip = miniCountdownLabel(trip, status, nowMs);

  return (
    <div
      data-testid="trip-card"
      className="ticket-surface flex items-center gap-s3 p-s3"
    >
      <Link
        href={`/trips/${trip.id}`}
        data-testid="trip-card-link"
        className="flex min-w-0 flex-1 items-center gap-s3"
      >
        <DestinationArt
          seed={trip.coverSeed}
          size={72}
          className="h-16 w-16 shrink-0 rounded-card"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-display text-base font-semibold">
            {trip.title}
          </p>
          <p className="truncate text-sm text-ink-soft">
            {trip.destinationCity}
            {trip.destinationCountry ? `, ${trip.destinationCountry}` : ""}
          </p>
          {sharedByLabel ? (
            <span
              data-testid="trip-shared-by-badge"
              className="w-fit rounded-pill bg-paper2 px-s2 py-0.5 text-[11px] font-semibold tracking-wide text-horizon-deep uppercase"
            >
              Shared by {sharedByLabel}
            </span>
          ) : null}
        </div>
        {chip ? (
          <span
            data-testid="trip-mini-countdown"
            className="shrink-0 rounded-pill bg-paper2 px-s3 py-1 font-mono text-xs font-semibold text-sunset-deep"
          >
            {chip}
          </span>
        ) : null}
      </Link>
      {showOwnerMenu ? <TripCardMenu tripId={trip.id} title={trip.title} /> : null}
    </div>
  );
}
