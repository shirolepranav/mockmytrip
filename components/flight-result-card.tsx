"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AirlineMark } from "@/components/airline-mark";
import type { FlightOfferView } from "@/lib/offer-view";
import {
  dayOffset,
  formatDuration,
  formatMoney,
  formatTimeInTz,
} from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { listItem, listItemReduced } from "@/lib/motion/variants";

/*
 * FlightResultCard (DS §9): airline mark, times, duration, stops, price and
 * the "you'd save" reframing. Shared-layout id carries the card into the
 * detail page transition.
 */

export function FlightResultCard({
  offer,
  href,
}: {
  offer: FlightOfferView;
  href: string;
}) {
  const { reduced } = useMotionPrefs();
  const plusDays = dayOffset(
    offer.departUtcMs,
    offer.originTz,
    offer.arriveUtcMs,
    offer.destTz,
  );

  return (
    <motion.li
      variants={reduced ? listItemReduced : listItem}
      layoutId={reduced ? undefined : `flight-${offer.id}`}
      className="list-none"
    >
      <Link
        href={href}
        data-testid="flight-card"
        className="ticket-surface group flex flex-col gap-s3 p-s4 transition-shadow hover:shadow-e2 motion-reduce:transition-none"
      >
        <div className="flex items-center gap-s3">
          <AirlineMark logoSeed={offer.airlineLogoSeed} hue={offer.airlineHue} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{offer.airlineName}</p>
            <p className="font-mono text-xs text-ink-soft">
              {offer.flightNumber} · {offer.cabin}
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-xl font-semibold">
              {formatMoney(offer.priceCents)}
            </p>
            <p className="text-xs font-semibold text-mint-ok">
              you&apos;d save {formatMoney(offer.savedCents)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-s3">
          <div>
            <p className="font-mono text-lg font-semibold">
              {formatTimeInTz(offer.departUtcMs, offer.originTz)}
            </p>
            <p className="text-sm text-ink-soft">{offer.originIata}</p>
          </div>
          <div
            aria-hidden
            className="relative flex-1 border-t-2 border-dashed border-line"
          >
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-paper2 px-s2 text-xs whitespace-nowrap text-ink-soft">
              {formatDuration(offer.durationMin)} ·{" "}
              {offer.stops.length === 0
                ? "nonstop"
                : `1 stop ${offer.stops[0].hubIata}`}
            </span>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">
              {formatTimeInTz(offer.arriveUtcMs, offer.destTz)}
              {plusDays > 0 ? (
                <sup className="ml-0.5 text-xs text-sunset-deep">
                  +{plusDays}
                </sup>
              ) : null}
            </p>
            <p className="text-sm text-ink-soft">{offer.destIata}</p>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}
