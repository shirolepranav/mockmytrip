"use client";

import { useState } from "react";
import Link from "next/link";
import { PassportCover } from "@/components/passport-cover";
import { SavingsTally } from "@/components/savings-tally";
import { StampDetailSheet } from "@/components/stamp-detail-sheet";
import { StampGrid } from "@/components/stamp-grid";
import type { StampCardData } from "@/components/stamp-card";
import { formatMiles } from "@/lib/format";

/*
 * Passport page client orchestrator (WF §16) — mirrors the confirmation
 * page's server-fetch -> client-children split. Holds the tapped-stamp
 * selection state that opens StampDetailSheet.
 */
export function PassportView({
  stamps,
  countryCount,
  cityCount,
  totalDistanceKm,
  savingsCents,
  entranceStampId,
}: {
  stamps: StampCardData[];
  countryCount: number;
  cityCount: number;
  totalDistanceKm: number;
  savingsCents: number;
  entranceStampId?: string;
}) {
  const [selected, setSelected] = useState<StampCardData | null>(null);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-s5">
      <PassportCover stampCount={stamps.length} />

      {stamps.length === 0 ? (
        <div
          data-testid="passport-empty-state"
          className="flex flex-col items-center gap-s3 py-s6 text-center"
        >
          <p className="max-w-prose text-ink-soft">
            Every pretend booking earns a very real-looking stamp. Book a
            trip to start your collection.
          </p>
          <Link
            href="/search/flights"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
          >
            Search flights
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-s3 text-center">
            <div>
              <p data-testid="passport-country-count" className="font-display text-2xl">
                {countryCount}
              </p>
              <p className="text-xs text-ink-soft uppercase">Countries</p>
            </div>
            <div>
              <p data-testid="passport-city-count" className="font-display text-2xl">
                {cityCount}
              </p>
              <p className="text-xs text-ink-soft uppercase">Cities</p>
            </div>
            <div>
              <p data-testid="passport-miles" className="font-display text-2xl">
                {formatMiles(totalDistanceKm)}
              </p>
              <p className="text-xs text-ink-soft uppercase">Dreamed</p>
            </div>
          </div>

          <p className="text-center text-ink-soft">
            You&apos;ve saved{" "}
            <SavingsTally
              cents={savingsCents}
              className="font-serif text-xl font-semibold text-mint-ok"
            />{" "}
            on trips that never happened.
          </p>

          <StampGrid
            stamps={stamps}
            entranceStampId={entranceStampId}
            onSelect={setSelected}
          />
        </>
      )}

      <StampDetailSheet stamp={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
