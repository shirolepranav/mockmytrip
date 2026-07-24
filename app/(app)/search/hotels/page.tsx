import { requireFlightDraft } from "@/lib/hotel-guard";
import { flightOfferViewSchema } from "@/lib/offer-view";
import { addDaysIso, isoDateInTz } from "@/lib/format";
import { HotelSearchForm } from "@/components/hotel-search-form";
import { SkipHotelButton } from "@/components/skip-hotel-button";
import type { SlimAirport } from "@/lib/airports-client";

/*
 * Hotel search (WF §6): destination + dates prefilled from the flight
 * draft, editable; guests default from passenger count. "Skip hotels" is
 * always available (task 6 — hotels are optional, unlike the flight).
 */

export const metadata = { title: "Search hotels" };

export default async function HotelSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const draft = await requireFlightDraft();
  const flight = flightOfferViewSchema.parse(draft.flight);
  const returnResult = flightOfferViewSchema.safeParse(draft.returnFlight);
  const returnFlight = returnResult.success ? returnResult.data : null;
  const params = await searchParams;

  const defaultCheckin = isoDateInTz(flight.arriveUtcMs, flight.destTz);
  const defaultCheckout = returnFlight
    ? isoDateInTz(returnFlight.departUtcMs, returnFlight.originTz)
    : addDaysIso(defaultCheckin, 3);

  // A prior hotel search (from the results page's "Edit search" link) wins
  // over the flight-derived defaults so re-opening this page doesn't reset it.
  const destination: SlimAirport = {
    iata: flight.destIata,
    name: params.city ?? flight.destCity,
    city: params.city ?? flight.destCity,
    country: params.country ?? flight.destCountry,
    lat: 0,
    lng: 0,
    tz: flight.destTz,
  };

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-s5">
      <header>
        <h1 className="font-display text-3xl">Find a place to stay</h1>
        <p className="mt-s2 text-ink-soft">
          {flight.destCity} is waiting. Pretend hotels, real relaxation —
          still $0.00.
        </p>
      </header>
      <HotelSearchForm
        initial={{
          destination,
          checkin: params.checkin ?? defaultCheckin,
          checkout: params.checkout ?? defaultCheckout,
          guests: params.guests
            ? Number(params.guests)
            : Math.min(9, flight.passengers),
          rooms: params.rooms ? Number(params.rooms) : 1,
        }}
      />
      <div className="flex justify-center">
        <SkipHotelButton />
      </div>
    </section>
  );
}
