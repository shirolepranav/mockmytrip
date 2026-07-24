"use client";

import { motion } from "motion/react";
import { DestinationArt } from "@/components/destination-art";
import { IconMapPin, IconStar } from "@/components/icons";
import type { HotelOfferView } from "@/lib/hotel-offer-view";
import { formatMoney } from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * Detail-page header: same hero art / stars / price as the hotel card,
 * sharing its layoutId (DS §8 item 6) so the two stay visually linked.
 */
export function HotelDetailHeader({ offer }: { offer: HotelOfferView }) {
  const { reduced } = useMotionPrefs();

  return (
    <motion.div
      layoutId={reduced ? undefined : `hotel-${offer.id}`}
      className="ticket-surface flex flex-col overflow-hidden"
    >
      <DestinationArt
        seed={offer.heroSeed}
        size={640}
        className="aspect-video w-full [&_svg]:h-full [&_svg]:w-full"
      />
      <div className="flex flex-col gap-s3 p-s5">
        <div className="flex items-start justify-between gap-s3">
          <div className="min-w-0">
            <p className="truncate font-display text-xl">{offer.name}</p>
            <p className="flex items-center gap-s1 text-sm text-ink-soft">
              <IconMapPin size={14} />
              {offer.neighborhood}, {offer.city}
            </p>
          </div>
          <div
            aria-label={`${offer.stars} stars`}
            className="flex shrink-0 items-center gap-0.5 text-gold"
          >
            {Array.from({ length: offer.stars }).map((_, index) => (
              <IconStar key={index} size={16} fill="currentColor" />
            ))}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold">
              {formatMoney(offer.nightlyCents)}
              <span className="ml-1 text-sm font-normal text-ink-soft">
                /night
              </span>
            </p>
            <p className="text-sm text-ink-soft">
              {formatMoney(offer.totalCents)} total · {offer.nights}{" "}
              {offer.nights === 1 ? "night" : "nights"}
            </p>
          </div>
          <p className="text-xs font-semibold text-mint-ok">
            you&apos;d save {formatMoney(offer.savedCents)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
