"use client";

import { motion } from "motion/react";
import { AirlineMark } from "@/components/airline-mark";
import type { FlightOfferView } from "@/lib/offer-view";
import { dayOffset, formatMoney, formatTimeInTz } from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * Detail-page header: same airline mark / times / price as the result card,
 * sharing its layoutId (DS §8 item 6) so the two stay visually linked.
 */
export function FlightDetailHeader({ offer }: { offer: FlightOfferView }) {
  const { reduced } = useMotionPrefs();
  const plusDays = dayOffset(
    offer.departUtcMs,
    offer.originTz,
    offer.arriveUtcMs,
    offer.destTz,
  );

  return (
    <motion.div
      layoutId={reduced ? undefined : `flight-${offer.id}`}
      className="ticket-surface flex flex-col gap-s4 p-s5"
    >
      <div className="flex items-center gap-s3">
        <AirlineMark
          logoSeed={offer.airlineLogoSeed}
          hue={offer.airlineHue}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl">{offer.airlineName}</p>
          <p className="font-mono text-xs text-ink-soft">
            {offer.flightNumber} · {offer.cabin}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl font-semibold">
            {formatMoney(offer.priceCents)}
          </p>
          <p className="text-xs font-semibold text-mint-ok">
            you&apos;d save {formatMoney(offer.savedCents)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-s3">
        <div>
          <p className="font-mono text-2xl font-semibold">
            {formatTimeInTz(offer.departUtcMs, offer.originTz)}
          </p>
          <p className="text-sm text-ink-soft">
            {offer.originCity} ({offer.originIata})
          </p>
        </div>
        <div
          aria-hidden
          className="relative flex-1 border-t-2 border-dashed border-line"
        />
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold">
            {formatTimeInTz(offer.arriveUtcMs, offer.destTz)}
            {plusDays > 0 ? (
              <sup className="ml-0.5 text-xs text-sunset-deep">+{plusDays}</sup>
            ) : null}
          </p>
          <p className="text-sm text-ink-soft">
            {offer.destCity} ({offer.destIata})
          </p>
        </div>
      </div>
    </motion.div>
  );
}
