import Link from "next/link";
import { redirect } from "next/navigation";
import { UnknownAirportError } from "@/lib/engine";
import { airports } from "@/lib/engine/airports";
import { getFlightOffers } from "@/lib/flight-results";
import type { FlightOfferView } from "@/lib/offer-view";
import {
  resultsParamsSchema,
  resultsQueryString,
  type ResultsParams,
} from "@/lib/search-params";
import { utcToZonedParts } from "@/lib/engine/timezone";
import { FlightResultsList } from "@/components/flight-results-list";
import { ResultsToolbar } from "@/components/results-toolbar";
import { formatDateInTz } from "@/lib/format";

/*
 * Flight results (WF §4): server-computed, seeded, deterministic — filters
 * and sort re-run the engine and land on identical offers every time.
 */

export const metadata = { title: "Flight results" };

function applyFiltersAndSort(
  offers: FlightOfferView[],
  params: ResultsParams,
): FlightOfferView[] {
  let list = offers;
  if (params.stops === "0") {
    list = list.filter((offer) => offer.stops.length === 0);
  }
  if (params.time) {
    list = list.filter((offer) => {
      const { hour } = utcToZonedParts(offer.departUtcMs, offer.originTz);
      if (params.time === "morning") return hour < 12;
      if (params.time === "afternoon") return hour >= 12 && hour < 18;
      return hour >= 18;
    });
  }
  if (params.airlines) {
    const wanted = new Set(params.airlines.split(","));
    list = list.filter((offer) => wanted.has(offer.airlineCode));
  }
  const sorted = [...list];
  if (params.sort === "price") {
    sorted.sort((a, b) => a.priceCents - b.priceCents);
  } else if (params.sort === "duration") {
    sorted.sort((a, b) => a.durationMin - b.durationMin);
  } else {
    sorted.sort((a, b) => a.departUtcMs - b.departUtcMs);
  }
  return sorted;
}

/** Airports sharing the destination's city — the "try nearby" suggestion. */
function nearbyAlternatives(iata: string): { iata: string; name: string }[] {
  const target = airports.find((airport) => airport.iata === iata);
  if (!target) return [];
  return airports
    .filter(
      (airport) =>
        airport.iata !== iata &&
        (airport.city === target.city || airport.region === target.region),
    )
    .slice(0, 3)
    .map((airport) => ({ iata: airport.iata, name: airport.name }));
}

export default async function FlightResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = resultsParamsSchema.safeParse(raw);
  if (!parsed.success) redirect("/search/flights");
  const params = parsed.data;

  // Round-trip return leg: swap the route and search the return date.
  const legOrigin = params.leg === "return" ? params.d : params.o;
  const legDest = params.leg === "return" ? params.o : params.d;
  const legDate =
    params.leg === "return" && params.return ? params.return : params.depart;

  let offers: FlightOfferView[];
  try {
    offers = await getFlightOffers({
      origin: legOrigin,
      destination: legDest,
      departDate: legDate,
      passengers: params.pax,
      cabin: params.cabin,
    });
  } catch (error) {
    if (error instanceof UnknownAirportError) redirect("/search/flights");
    throw error;
  }

  const visible = applyFiltersAndSort(offers, params);
  const airlineOptions = [
    ...new Map(
      offers.map((offer) => [
        offer.airlineCode,
        { code: offer.airlineCode, name: offer.airlineName },
      ]),
    ).values(),
  ];
  const detailQuery = resultsQueryString(params);
  const editHref = `/search/flights?${new URLSearchParams({
    o: params.o,
    d: params.d,
    depart: params.depart,
    ...(params.return ? { return: params.return } : {}),
    pax: String(params.pax),
    cabin: params.cabin,
  }).toString()}`;

  const first = offers[0];

  return (
    <section className="flex flex-col gap-s4">
      <header className="flex flex-wrap items-end justify-between gap-s3">
        <div>
          {params.leg === "return" ? (
            <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
              Return leg
            </p>
          ) : null}
          <h1 className="font-display text-2xl">
            {first ? `${first.originCity} → ${first.destCity}` : "Flights"}
          </h1>
          <p className="text-sm text-ink-soft">
            {first ? formatDateInTz(first.departUtcMs, first.originTz) : ""} ·{" "}
            {params.pax} {params.pax === 1 ? "dreamer" : "dreamers"} ·{" "}
            {params.cabin}
          </p>
        </div>
        <Link
          href={editHref}
          className="min-h-11 rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Edit search
        </Link>
      </header>

      <ResultsToolbar airlines={airlineOptions} />

      {visible.length > 0 ? (
        <FlightResultsList offers={visible} detailQuery={detailQuery} />
      ) : (
        <div className="ticket-surface flex flex-col items-start gap-s3 p-s6">
          <h2 className="font-display text-xl">
            No flights match those filters
          </h2>
          <p className="text-ink-soft">
            Even a simulation has limits. Loosen a filter, or try a nearby
            airport:
          </p>
          <div className="flex flex-wrap gap-s2">
            <Link
              href={`/search/flights/results?${new URLSearchParams({
                o: params.o,
                d: params.d,
                depart: params.depart,
                pax: String(params.pax),
                cabin: params.cabin,
              }).toString()}`}
              className="min-h-11 rounded-pill bg-ink px-s4 py-s2 font-semibold text-paper2"
            >
              Clear filters
            </Link>
            {nearbyAlternatives(legDest).map((alternative) => (
              <Link
                key={alternative.iata}
                href={`/search/flights/results?${new URLSearchParams({
                  o: params.o,
                  d: alternative.iata,
                  depart: params.depart,
                  pax: String(params.pax),
                  cabin: params.cabin,
                }).toString()}`}
                className="min-h-11 rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold"
              >
                {alternative.name} ({alternative.iata})
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
