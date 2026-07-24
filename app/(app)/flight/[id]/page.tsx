import Link from "next/link";
import { notFound } from "next/navigation";
import { UnknownAirportError, type Cabin } from "@/lib/engine";
import { aircraftFor, baggageAllowanceFor, fareOptionsFor } from "@/lib/engine/flavor";
import { getFlightOffers } from "@/lib/flight-results";
import { resultsParamsSchema, resultsQueryString } from "@/lib/search-params";
import { formatDuration } from "@/lib/format";
import { FlightDetailHeader } from "@/components/flight-detail-header";
import { FareOptions } from "@/components/fare-options";
import { SelectFlightForm } from "@/components/select-flight-form";
import { IconSuitcase } from "@/components/icons";

/*
 * Flight detail (WF §5): segment breakdown, fare options, aircraft/baggage
 * flavor, "Select this flight" → trip draft. Resolves the offer by re-running
 * the same cached, seeded search the results page used (offers aren't
 * persisted anywhere — lib/search-params.ts's resultsParamsSchema is shared
 * by both pages so they parse the query identically).
 */

export const metadata = { title: "Flight details" };

export default async function FlightDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const parsed = resultsParamsSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const query = parsed.data;

  const legOrigin = query.leg === "return" ? query.d : query.o;
  const legDest = query.leg === "return" ? query.o : query.d;
  const legDate =
    query.leg === "return" && query.return ? query.return : query.depart;

  let offers;
  try {
    offers = await getFlightOffers({
      origin: legOrigin,
      destination: legDest,
      departDate: legDate,
      passengers: query.pax,
      cabin: query.cabin,
    });
  } catch (error) {
    if (error instanceof UnknownAirportError) notFound();
    throw error;
  }

  const offer = offers.find((candidate) => candidate.id === id);
  if (!offer) notFound();

  const aircraft = aircraftFor(offer);
  const baggage = baggageAllowanceFor(offer.cabin as Cabin);
  const fares = fareOptionsFor(offer);
  const resultsHref = `/search/flights/results?${resultsQueryString(query)}`;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s5">
      <Link
        href={resultsHref}
        className="min-h-11 self-start rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        ← Back to results
      </Link>

      <FlightDetailHeader offer={offer} />

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Route</h2>
        {offer.stops.length === 0 ? (
          <p className="text-ink-soft">
            Nonstop · {formatDuration(offer.durationMin)}
          </p>
        ) : (
          <ol className="flex flex-col gap-s2">
            {offer.stops.map((stop, index) => (
              <li
                key={`${stop.hubIata}-${index}`}
                className="flex items-center justify-between rounded-card border border-line bg-paper2 px-s3 py-s2 text-sm"
              >
                <span>
                  Layover in {stop.hubCity} ({stop.hubIata})
                </span>
                <span className="text-ink-soft">
                  {formatDuration(stop.layoverMin)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-sm text-ink-soft">
          {aircraft} · {offer.passengers}{" "}
          {offer.passengers === 1 ? "dreamer" : "dreamers"} · total flight time{" "}
          {formatDuration(offer.durationMin)}
        </p>
        <p className="flex items-center gap-s2 text-sm text-ink-soft">
          <IconSuitcase size={16} />
          {baggage}
        </p>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Fare options</h2>
        <FareOptions options={fares} />
      </div>

      <SelectFlightForm
        offer={offer}
        leg={query.leg}
        search={{
          o: query.o,
          d: query.d,
          depart: query.depart,
          return: query.return,
          pax: query.pax,
          cabin: query.cabin,
        }}
      />
    </section>
  );
}
