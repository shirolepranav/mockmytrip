"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { DestinationArt } from "@/components/destination-art";
import { IconMapPin, IconStar } from "@/components/icons";
import type { HotelOfferView } from "@/lib/hotel-offer-view";
import { formatMoney } from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { listItem, listItemReduced } from "@/lib/motion/variants";

/*
 * HotelCard (DS §9): seeded hero art, stars, neighborhood, amenity chips,
 * nightly + total price and the "you'd save" reframing. Shared-layout id
 * carries the card into the detail page transition, mirroring
 * FlightResultCard.
 */
export function HotelCard({
  offer,
  href,
}: {
  offer: HotelOfferView;
  href: string;
}) {
  const { reduced } = useMotionPrefs();
  const shownAmenities = offer.amenities.slice(0, 3);
  const extraCount = offer.amenities.length - shownAmenities.length;

  return (
    <motion.li
      variants={reduced ? listItemReduced : listItem}
      layoutId={reduced ? undefined : `hotel-${offer.id}`}
      className="list-none"
    >
      <Link
        href={href}
        data-testid="hotel-card"
        className="ticket-surface group flex flex-col overflow-hidden transition-shadow hover:shadow-e2 motion-reduce:transition-none"
      >
        <DestinationArt
          seed={offer.heroSeed}
          size={480}
          className="aspect-video w-full [&_svg]:h-full [&_svg]:w-full"
        />

        <div className="flex flex-col gap-s2 p-s4">
          <div className="flex items-start justify-between gap-s3">
            <div className="min-w-0">
              <p data-testid="hotel-name" className="truncate font-semibold">
                {offer.name}
              </p>
              <p className="flex items-center gap-s1 text-sm text-ink-soft">
                <IconMapPin size={14} />
                {offer.neighborhood}
              </p>
            </div>
            <div
              aria-label={`${offer.stars} stars`}
              className="flex shrink-0 items-center gap-0.5 text-gold"
            >
              {Array.from({ length: offer.stars }).map((_, index) => (
                <IconStar key={index} size={14} fill="currentColor" />
              ))}
            </div>
          </div>

          {shownAmenities.length > 0 ? (
            <div className="flex flex-wrap gap-s1">
              {shownAmenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-pill border border-line bg-paper2 px-s2 py-0.5 text-xs text-ink-soft"
                >
                  {amenity}
                </span>
              ))}
              {extraCount > 0 ? (
                <span className="rounded-pill border border-line bg-paper2 px-s2 py-0.5 text-xs text-ink-soft">
                  +{extraCount} more
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-end justify-between">
            <div>
              <p className="font-serif text-xl font-semibold">
                {formatMoney(offer.nightlyCents)}
                <span className="ml-1 text-sm font-normal text-ink-soft">
                  /night
                </span>
              </p>
              <p className="text-xs text-ink-soft">
                {formatMoney(offer.totalCents)} total · {offer.nights}{" "}
                {offer.nights === 1 ? "night" : "nights"}
              </p>
            </div>
            <p className="text-xs font-semibold text-mint-ok">
              you&apos;d save {formatMoney(offer.savedCents)}
            </p>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}
