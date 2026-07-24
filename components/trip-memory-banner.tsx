import Link from "next/link";
import type { TripRow } from "@/lib/services/trips";
import { formatDateInTz } from "@/lib/format";

/*
 * Trip detail's Memory state (WF §13 past-dated guard): a trip already past
 * on load skips gracefully here instead of ever mounting CountdownFlip —
 * no negative countdown is possible because a countdown is never rendered
 * for a memory-status trip. Phase-6-scoped; the full Trip Memories page
 * (postcard/recap/reflection note) is Tier 2 (WF §17).
 */
export function TripMemoryBanner({
  trip,
}: {
  trip: Pick<
    TripRow,
    "title" | "destinationCity" | "destinationCountry" | "startDate" | "endDate"
  >;
}) {
  return (
    <section
      data-testid="trip-memory-banner"
      className="ticket-surface mx-auto flex max-w-xl flex-col items-center gap-s3 rounded-card p-s6 text-center"
    >
      <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">
        Memory
      </p>
      <h1 className="font-display text-2xl">{trip.title}</h1>
      <p className="text-ink-soft">
        {trip.destinationCity}
        {trip.destinationCountry ? `, ${trip.destinationCountry}` : ""} ·{" "}
        {formatDateInTz(trip.startDate.getTime(), "UTC")} –{" "}
        {formatDateInTz(trip.endDate.getTime(), "UTC")}
      </p>
      <p className="max-w-prose text-sm text-ink-soft">
        This trip is now a memory. Your passport stamp is still there.
      </p>
      <Link
        href="/passport"
        className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
      >
        View passport
      </Link>
    </section>
  );
}
