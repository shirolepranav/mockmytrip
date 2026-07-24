import Link from "next/link";
import { AirlineMark } from "@/components/airline-mark";
import { DestinationArt } from "@/components/destination-art";
import { IconMapPin } from "@/components/icons";
import type { FlightOfferView } from "@/lib/offer-view";
import type { HotelOfferView } from "@/lib/hotel-offer-view";
import { formatDateInTz, formatMoney, formatTimeInTz } from "@/lib/format";

/*
 * A flight or hotel segment on the trip summary (WF §9), with its "Edit"
 * link back to the relevant search preserving state.
 */
type Segment =
  | { kind: "flight"; label: string; offer: FlightOfferView; editHref: string }
  | { kind: "hotel"; offer: HotelOfferView; editHref: string };

export function TripSegmentCard(segment: Segment) {
  if (segment.kind === "flight") {
    const { offer, editHref, label } = segment;
    return (
      <div className="ticket-surface flex flex-col gap-s3 p-s4">
        <div className="flex items-center justify-between gap-s3">
          <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
            {label}
          </p>
          <Link
            href={editHref}
            className="text-sm font-semibold text-horizon-deep hover:underline"
          >
            Edit
          </Link>
        </div>
        <div className="flex items-center gap-s3">
          <AirlineMark
            logoSeed={offer.airlineLogoSeed}
            hue={offer.airlineHue}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {offer.originCity} ({offer.originIata}) → {offer.destCity} (
              {offer.destIata})
            </p>
            <p className="text-sm text-ink-soft">
              {formatDateInTz(offer.departUtcMs, offer.originTz)} ·{" "}
              {formatTimeInTz(offer.departUtcMs, offer.originTz)} ·{" "}
              {offer.airlineName} {offer.flightNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-lg font-semibold">
              {formatMoney(offer.priceCents)}
            </p>
            <p className="text-xs font-semibold text-mint-ok">
              save {formatMoney(offer.savedCents)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { offer, editHref } = segment;
  return (
    <div className="ticket-surface flex flex-col gap-s3 p-s4">
      <div className="flex items-center justify-between gap-s3">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          Stay
        </p>
        <Link
          href={editHref}
          className="text-sm font-semibold text-horizon-deep hover:underline"
        >
          Edit
        </Link>
      </div>
      <div className="flex items-center gap-s3">
        <DestinationArt
          seed={offer.heroSeed}
          size={72}
          className="size-14 shrink-0 overflow-hidden rounded-card [&_svg]:h-full [&_svg]:w-full"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{offer.name}</p>
          <p className="flex items-center gap-s1 text-sm text-ink-soft">
            <IconMapPin size={14} />
            {offer.neighborhood}, {offer.city} · {offer.nights}{" "}
            {offer.nights === 1 ? "night" : "nights"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-lg font-semibold">
            {formatMoney(offer.totalCents)}
          </p>
          <p className="text-xs font-semibold text-mint-ok">
            save {formatMoney(offer.savedCents)}
          </p>
        </div>
      </div>
    </div>
  );
}
