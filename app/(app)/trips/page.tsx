import Link from "next/link";
import { readSessionUserId } from "@/lib/auth/session";
import { getUser } from "@/lib/services/users";
import { listTrips, statusOf, type TripRow, type TripStatus } from "@/lib/services/trips";
import { TripCard } from "@/components/trip-card";
import { SavingsTally } from "@/components/savings-tally";
import { currentTimeMs } from "@/lib/countdown";

/*
 * My Trips dashboard (WF §12): TripCards grouped Upcoming/In progress/
 * Memories, savings-tally header, "Plan another" CTA. Trip status is
 * recomputed on every read via statusOf — no cron needed.
 */

export const metadata = { title: "My Trips" };

const GROUPS: { status: TripStatus; label: string }[] = [
  { status: "upcoming", label: "Upcoming" },
  { status: "in_progress", label: "In progress" },
  { status: "memory", label: "Memories" },
];

export default async function TripsPage() {
  const userId = await readSessionUserId();
  const nowMs = currentTimeMs();

  const trips = userId ? await listTrips(userId) : [];
  const user = userId ? await getUser(userId) : null;

  if (trips.length === 0) {
    return (
      <section className="flex flex-col items-start gap-s3">
        <h1 className="font-display text-2xl">Your adventures await</h1>
        <p className="max-w-prose text-ink-soft">
          Booked trips, countdowns, and memories will live here. Search a
          flight to plant your first pin on the map.
        </p>
        <Link
          href="/search/flights"
          className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
        >
          Plan a trip
        </Link>
      </section>
    );
  }

  const now = new Date(nowMs);
  const grouped: Record<TripStatus, TripRow[]> = {
    upcoming: [],
    in_progress: [],
    memory: [],
  };
  for (const trip of trips) {
    grouped[statusOf(trip, now)].push(trip);
  }

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-wrap items-center justify-between gap-s3">
        <h1 className="font-display text-2xl">My Trips</h1>
        <div className="ticket-surface px-s4 py-s2 text-sm">
          <span className="text-ink-soft">Total saved </span>
          <SavingsTally
            cents={user?.totalSavedCents ?? 0}
            className="font-mono font-bold text-mint-ok"
          />
        </div>
      </header>

      {GROUPS.map(({ status, label }) => (
        <TripGroup
          key={status}
          label={label}
          trips={grouped[status]}
          status={status}
          nowMs={nowMs}
        />
      ))}

      <Link
        href="/search/flights"
        className="press-physical inline-flex min-h-11 items-center self-start rounded-pill border border-line px-s5 font-semibold text-ink"
      >
        Plan another
      </Link>
    </section>
  );
}

function TripGroup({
  label,
  trips,
  status,
  nowMs,
}: {
  label: string;
  trips: TripRow[];
  status: TripStatus;
  nowMs: number;
}) {
  if (trips.length === 0) return null;
  return (
    <div className="flex flex-col gap-s3">
      <h2 className="font-display text-lg text-ink-soft">{label}</h2>
      <div className="flex flex-col gap-s2" data-testid={`trip-group-${status}`}>
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} status={status} nowMs={nowMs} />
        ))}
      </div>
    </div>
  );
}
