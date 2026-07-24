import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFlightDraft } from "@/lib/hotel-guard";
import { getHotelOffers } from "@/lib/hotel-results";
import type { HotelOfferView } from "@/lib/hotel-offer-view";
import {
  hotelResultsParamsSchema,
  hotelResultsQueryString,
  type HotelResultsParams,
} from "@/lib/hotel-search-params";
import { HotelResultsList } from "@/components/hotel-results-list";
import { HotelResultsToolbar } from "@/components/hotel-results-toolbar";

/*
 * Hotel results (WF §7): server-computed, seeded, deterministic — filters
 * and sort re-run the engine and land on identical offers every time,
 * mirroring the flight results page.
 */

export const metadata = { title: "Hotel results" };

function applyHotelFiltersAndSort(
  offers: HotelOfferView[],
  params: HotelResultsParams,
): HotelOfferView[] {
  let list = offers;
  if (params.minStars) {
    const min = Number(params.minStars);
    list = list.filter((offer) => offer.stars >= min);
  }
  if (params.amenities) {
    const wanted = params.amenities.split(",");
    list = list.filter((offer) =>
      wanted.every((amenity) => offer.amenities.includes(amenity)),
    );
  }
  const sorted = [...list];
  if (params.sort === "stars") {
    sorted.sort(
      (a, b) => b.stars - a.stars || a.nightlyCents - b.nightlyCents,
    );
  } else {
    sorted.sort((a, b) => a.nightlyCents - b.nightlyCents);
  }
  return sorted;
}

export default async function HotelResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireFlightDraft();
  const raw = await searchParams;
  const parsed = hotelResultsParamsSchema.safeParse(raw);
  if (!parsed.success) redirect("/search/hotels");
  const params = parsed.data;

  const offers = await getHotelOffers({
    city: params.city,
    country: params.country,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: params.guests,
    rooms: params.rooms,
  });

  const visible = applyHotelFiltersAndSort(offers, params);
  const amenityOptions = [
    ...new Set(offers.flatMap((offer) => offer.amenities)),
  ].sort();
  const detailQuery = hotelResultsQueryString(params);
  const searchQuery = {
    city: params.city,
    country: params.country,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: String(params.guests),
    rooms: String(params.rooms),
  };
  const editHref = `/search/hotels?${new URLSearchParams(searchQuery).toString()}`;

  return (
    <section className="flex flex-col gap-s4">
      <header className="flex flex-wrap items-end justify-between gap-s3">
        <div>
          <h1 className="font-display text-2xl">{params.city}</h1>
          <p className="text-sm text-ink-soft">
            {params.checkin} → {params.checkout} · {params.guests}{" "}
            {params.guests === 1 ? "guest" : "guests"} · {params.rooms}{" "}
            {params.rooms === 1 ? "room" : "rooms"}
          </p>
        </div>
        <Link
          href={editHref}
          className="min-h-11 rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Edit search
        </Link>
      </header>

      <HotelResultsToolbar amenities={amenityOptions} />

      {visible.length > 0 ? (
        <HotelResultsList offers={visible} detailQuery={detailQuery} />
      ) : (
        <div className="ticket-surface flex flex-col items-start gap-s3 p-s6">
          <h2 className="font-display text-xl">
            No hotels match those filters
          </h2>
          <p className="text-ink-soft">
            Even a simulation has limits. Loosen a filter and try again.
          </p>
          <Link
            href={`/search/hotels/results?${new URLSearchParams(searchQuery).toString()}`}
            className="min-h-11 rounded-pill bg-ink px-s4 py-s2 font-semibold text-paper2"
          >
            Clear filters
          </Link>
        </div>
      )}
    </section>
  );
}
