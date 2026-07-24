"use client";

import { motion } from "motion/react";
import { HotelCard } from "@/components/hotel-card";
import type { HotelOfferView } from "@/lib/hotel-offer-view";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { staggerList, staggerListReduced } from "@/lib/motion/variants";

/* Staggered results list (DS §7), mirrors FlightResultsList. */
export function HotelResultsList({
  offers,
  detailQuery,
}: {
  offers: HotelOfferView[];
  detailQuery: string;
}) {
  const { reduced } = useMotionPrefs();
  return (
    <motion.ul
      variants={reduced ? staggerListReduced : staggerList}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-s3 sm:grid-cols-2"
    >
      {offers.map((offer) => (
        <HotelCard
          key={offer.id}
          offer={offer}
          href={`/hotel/${offer.id}?${detailQuery}`}
        />
      ))}
    </motion.ul>
  );
}
