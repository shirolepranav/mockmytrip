import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getTrip } from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { tripLengthDays } from "@/lib/services/itinerary";
import { listPoisForCity, nearestSeededCity } from "@/lib/services/pois";
import { ExploreView } from "@/components/explore-view";

/* Trip-scoped Explore (WF §20): city pre-filled from the trip's destination,
   "Add to itinerary" wired to this trip's day-picker. */

export const metadata = { title: "Explore" };

export default async function TripExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ city?: string }>;
}) {
  const { tripId } = await params;
  const { city: cityOverride } = await searchParams;
  const userId = await readSessionUserId();
  if (!userId) notFound();

  let trip;
  try {
    trip = await getTrip(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }

  const city = cityOverride || trip.destinationCity;
  const dayCount = tripLengthDays(trip);
  const pois = await listPoisForCity(city);
  const nearestCity = pois.length === 0 ? await nearestSeededCity(city) : null;

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          {trip.title}
        </p>
        <h1 className="font-display text-2xl">Explore {city}</h1>
      </header>
      <ExploreView
        city={city}
        pois={pois}
        nearestCity={nearestCity}
        tripId={tripId}
        dayCount={dayCount}
      />
    </section>
  );
}
