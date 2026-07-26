"use client";

import { motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { enterUp, enterUpReduced } from "@/lib/motion/variants";
import { formatMoney, kmToMiles } from "@/lib/format";
import { DestinationArt } from "@/components/destination-art";
import { PassportStamp } from "@/components/passport-stamp";

export interface MemoryPostcardProps {
  coverSeed: number;
  destinationCity: string;
  destinationCountry: string | null;
  originCity: string | null;
  dateRangeLabel: string;
  distanceKm: number;
  savingsCents: number;
  stamp: {
    stampStyle: number;
    rotationDeg: number;
    inkHue: number;
    city: string;
    countryIso: string;
    dateLabel: string;
  } | null;
}

/*
 * The unlocked recap (Phase 8 task 5, WF §17): destination art + stamp +
 * route + savings, composed entirely from existing reads (getStampForTrip,
 * getTripSavingsCents, getOutboundFlightContext) — no new computation.
 * Entrance reuses the standard enterUp/enterUpReduced pair, already
 * reduced-motion-safe, so no new animation variant was needed here.
 */
export function MemoryPostcard({
  coverSeed,
  destinationCity,
  destinationCountry,
  originCity,
  dateRangeLabel,
  distanceKm,
  savingsCents,
  stamp,
}: MemoryPostcardProps) {
  const { reduced } = useMotionPrefs();

  return (
    <motion.div
      data-testid="memory-postcard"
      variants={reduced ? enterUpReduced : enterUp}
      initial="hidden"
      animate="visible"
      className="ticket-surface flex flex-col gap-s4 p-s5"
    >
      <DestinationArt
        seed={coverSeed}
        size={640}
        className="aspect-[16/9] w-full rounded-lg"
      />
      <div className="flex flex-wrap items-center justify-between gap-s4">
        <div className="flex flex-col gap-s1">
          <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
            {originCity ? `${originCity} → ` : ""}
            {destinationCity}
            {destinationCountry ? `, ${destinationCountry}` : ""}
          </p>
          <p className="text-sm text-ink-soft">{dateRangeLabel}</p>
        </div>
        {stamp ? <PassportStamp {...stamp} size={88} /> : null}
      </div>
      <p className="text-sm text-ink-soft">
        {distanceKm > 0 ? (
          <>
            <span className="font-mono font-bold text-ink">
              {kmToMiles(distanceKm).toLocaleString("en-US")} miles
            </span>{" "}
            dreamed, and you saved{" "}
          </>
        ) : (
          "You saved "
        )}
        <span className="font-mono font-bold text-mint-ok">
          {formatMoney(savingsCents)}
        </span>{" "}
        on this pretend trip — every price here is $0.00, always.
      </p>
    </motion.div>
  );
}
