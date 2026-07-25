import { listPoisForCity, nearestSeededCity } from "@/lib/services/pois";
import { ExploreView } from "@/components/explore-view";

/*
 * Standalone Explore (WF §20): reachable from flight/hotel detail's
 * "What's there?" links. No trip context, so "Add to itinerary" is hidden.
 */

export const metadata = { title: "Explore" };

export default async function ExploreCityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: encodedCity } = await params;
  const city = decodeURIComponent(encodedCity);

  const pois = await listPoisForCity(city);
  const nearestCity = pois.length === 0 ? await nearestSeededCity(city) : null;

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Explore
        </p>
        <h1 className="font-display text-2xl">{city}</h1>
      </header>
      <ExploreView city={city} pois={pois} nearestCity={nearestCity} />
    </section>
  );
}
