import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFlightDraft } from "@/lib/hotel-guard";
import { getHotelOffers } from "@/lib/hotel-results";
import {
  hotelResultsParamsSchema,
  hotelResultsQueryString,
} from "@/lib/hotel-search-params";
import { roomTypesFor } from "@/lib/engine/hotel-flavor";
import { HotelDetailHeader } from "@/components/hotel-detail-header";
import { HotelGallery } from "@/components/hotel-gallery";
import { HotelMapIllustration } from "@/components/hotel-map-illustration";
import { RoomTypes } from "@/components/room-types";
import { SelectHotelForm } from "@/components/select-hotel-form";
import { hashSeed } from "@/lib/engine/seed";

/*
 * Hotel detail (WF §8): seeded gallery, amenities, room types, illustrative
 * map, "Select hotel" → trip draft. Resolves the offer by re-running the
 * same cached, seeded search the results page used — offers aren't
 * persisted anywhere, mirroring flight/[id]/page.tsx.
 */

export const metadata = { title: "Hotel details" };

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireFlightDraft();
  const { id } = await params;
  const raw = await searchParams;
  const parsed = hotelResultsParamsSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const query = parsed.data;

  const offers = await getHotelOffers({
    city: query.city,
    country: query.country,
    checkin: query.checkin,
    checkout: query.checkout,
    guests: query.guests,
    rooms: query.rooms,
  });
  const offer = offers.find((candidate) => candidate.id === id);
  if (!offer) notFound();

  const roomTypes = roomTypesFor(offer);
  const resultsHref = `/search/hotels/results?${hotelResultsQueryString(query)}`;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-s5">
      <Link
        href={resultsHref}
        className="min-h-11 self-start rounded-pill border border-line bg-paper2 px-s4 py-s2 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        ← Back to results
      </Link>

      <HotelDetailHeader offer={offer} />

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Gallery</h2>
        <HotelGallery offerId={offer.id} />
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Amenities</h2>
        <div className="flex flex-wrap gap-s2">
          {offer.amenities.map((amenity) => (
            <span
              key={amenity}
              className="rounded-pill border border-line bg-paper2 px-s3 py-s1 text-sm text-ink-soft"
            >
              {amenity}
            </span>
          ))}
        </div>
      </div>

      <div className="ticket-surface flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-lg">Room types</h2>
        <RoomTypes options={roomTypes} />
      </div>

      <HotelMapIllustration
        seed={hashSeed(`map:${offer.id}`)}
        neighborhood={offer.neighborhood}
      />

      <SelectHotelForm offer={offer} search={query} />
    </section>
  );
}
