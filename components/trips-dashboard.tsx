"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { SavingsTally } from "@/components/savings-tally";
import { TripCard, type TripCardData } from "@/components/trip-card";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { staggerList, staggerListReduced } from "@/lib/motion/variants";

/*
 * My Trips dashboard (WF §12): groups trips into Upcoming / In progress /
 * Memories, an illustrated empty state, and a savings-tally header. Status
 * is computed once server-side (statusOf at request time) — grouping
 * doesn't live-recompute mid-session; a trip that transitions status while
 * this page is open updates on the next visit/reload.
 */

const GROUPS: { status: TripCardData["status"]; heading: string }[] = [
  { status: "upcoming", heading: "Upcoming" },
  { status: "in_progress", heading: "In progress" },
  { status: "memory", heading: "Memories" },
];

export function TripsDashboard({
  trips,
  nowUtcMs,
  savingsCents,
}: {
  trips: TripCardData[];
  nowUtcMs: number;
  savingsCents?: number;
}) {
  const { reduced } = useMotionPrefs();

  if (trips.length === 0) {
    return (
      <section
        data-testid="trips-empty-state"
        className="flex flex-col items-center gap-s4 py-s7 text-center"
      >
        <h1 className="font-display text-2xl">Your adventures await</h1>
        <p className="max-w-prose text-ink-soft">
          Search a flight, &quot;book&quot; it for $0.00, and your first trip
          will show up here.
        </p>
        <Link
          href="/search/flights"
          className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
        >
          Search flights
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-col gap-s1">
        <h1 className="font-display text-2xl">My Trips</h1>
        {savingsCents !== undefined ? (
          <p className="text-ink-soft">
            You&apos;ve saved{" "}
            <SavingsTally
              cents={savingsCents}
              className="font-serif text-lg font-semibold text-mint-ok"
            />{" "}
            across every trip that never happened.
          </p>
        ) : null}
      </header>

      {GROUPS.map(({ status, heading }) => {
        const groupTrips = trips.filter((trip) => trip.status === status);
        if (groupTrips.length === 0) return null;
        return (
          <div key={status} data-testid={`trip-group-${status}`}>
            <h2 className="mb-s3 font-display text-lg">{heading}</h2>
            <motion.ul
              variants={reduced ? staggerListReduced : staggerList}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-s3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {groupTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} nowUtcMs={nowUtcMs} />
              ))}
            </motion.ul>
          </div>
        );
      })}
    </section>
  );
}
