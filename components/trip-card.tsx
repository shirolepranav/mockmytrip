"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { DestinationArt } from "@/components/destination-art";
import { MiniCountdownChip } from "@/components/mini-countdown-chip";
import { TripCardMenu } from "@/components/trip-card-menu";
import type { TripStatus } from "@/lib/services/trips";
import { formatDateInTz } from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { listItem, listItemReduced } from "@/lib/motion/variants";

export interface TripCardData {
  id: string;
  title: string;
  destinationCity: string;
  destinationCountry: string | null;
  coverSeed: number;
  startUtcMs: number;
  endUtcMs: number;
  status: TripStatus;
}

/*
 * TripCard (WF §12): a "stretched link" tile — the whole card navigates to
 * the trip detail page via an absolutely-positioned Link, while the
 * overflow menu sits above it with its own interactive surface (a <button>
 * can't nest inside an <a>, so this is the standard pattern instead of
 * making the whole card a Link like HotelCard does).
 */
export function TripCard({
  trip,
  nowUtcMs,
}: {
  trip: TripCardData;
  nowUtcMs: number;
}) {
  const { reduced } = useMotionPrefs();

  return (
    <motion.li
      variants={reduced ? listItemReduced : listItem}
      data-testid="trip-card"
      className="ticket-surface relative flex flex-col overflow-hidden"
    >
      <Link
        href={`/trips/${trip.id}`}
        aria-label={`${trip.title}, ${trip.destinationCity}`}
        className="absolute inset-0 z-0"
      />
      <div className="pointer-events-none relative">
        <DestinationArt
          seed={trip.coverSeed}
          size={480}
          className="aspect-video w-full [&_svg]:h-full [&_svg]:w-full"
        />
      </div>
      <div className="pointer-events-none relative flex flex-col gap-s2 p-s4">
        <p data-testid="trip-card-title" className="truncate font-semibold">
          {trip.title}
        </p>
        <p className="text-sm text-ink-soft">
          {trip.destinationCity}
          {trip.destinationCountry ? `, ${trip.destinationCountry}` : ""}
        </p>
        {trip.status === "upcoming" ? (
          <MiniCountdownChip targetUtcMs={trip.startUtcMs} nowUtcMs={nowUtcMs} />
        ) : trip.status === "in_progress" ? (
          <span
            data-testid="trip-card-in-progress"
            className="inline-flex w-fit items-center rounded-pill border border-line bg-paper2 px-s2 py-0.5 font-mono text-xs text-horizon-deep"
          >
            Traveling now
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-soft">
            {formatDateInTz(trip.startUtcMs, "UTC")} –{" "}
            {formatDateInTz(trip.endUtcMs, "UTC")}
          </span>
        )}
      </div>
      <div className="pointer-events-auto absolute top-s3 right-s3 z-10">
        <TripCardMenu tripId={trip.id} title={trip.title} />
      </div>
    </motion.li>
  );
}
