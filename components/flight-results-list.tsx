"use client";

import { motion } from "motion/react";
import { FlightResultCard } from "@/components/flight-result-card";
import type { FlightOfferView } from "@/lib/offer-view";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { staggerList, staggerListReduced } from "@/lib/motion/variants";

/* Staggered results list (40–60ms per DS §7). */
export function FlightResultsList({
  offers,
  detailQuery,
}: {
  offers: FlightOfferView[];
  detailQuery: string;
}) {
  const { reduced } = useMotionPrefs();
  return (
    <motion.ul
      variants={reduced ? staggerListReduced : staggerList}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-s3"
    >
      {offers.map((offer) => (
        <FlightResultCard
          key={offer.id}
          offer={offer}
          href={`/flight/${offer.id}?${detailQuery}`}
        />
      ))}
    </motion.ul>
  );
}
