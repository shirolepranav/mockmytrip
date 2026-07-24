import { readSessionUserId } from "@/lib/auth/session";
import { listTrips, statusOf } from "@/lib/services/trips";
import { getUser } from "@/lib/services/users";
import { TripsDashboard } from "@/components/trips-dashboard";
import type { TripCardData } from "@/components/trip-card";

/* My Trips dashboard (WF §12, Phase 6 task 1) — replaces the Phase 5 stub. */

export const metadata = { title: "My Trips" };

export default async function TripsPage() {
  const userId = await readSessionUserId();
  const now = new Date();

  if (!userId) {
    return <TripsDashboard trips={[]} nowUtcMs={now.getTime()} />;
  }

  const [trips, user] = await Promise.all([listTrips(userId), getUser(userId)]);
  const cards: TripCardData[] = trips.map((trip) => ({
    id: trip.id,
    title: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    coverSeed: trip.coverSeed,
    startUtcMs: trip.startDate.getTime(),
    endUtcMs: trip.endDate.getTime(),
    status: statusOf(trip, now),
  }));

  return (
    <TripsDashboard
      trips={cards}
      nowUtcMs={now.getTime()}
      savingsCents={trips.length > 0 ? (user?.totalSavedCents ?? 0) : undefined}
    />
  );
}
