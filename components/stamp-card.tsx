"use client";

import { PassportStamp } from "@/components/passport-stamp";

export interface StampCardData {
  id: string;
  city: string;
  countryIso: string;
  stampStyle: number;
  rotationDeg: number;
  inkHue: number;
  dateLabel: string;
  distanceKm: number;
  tripId: string | null;
}

/*
 * Thin, deterministic wrapper around the already-reusable PassportStamp
 * (built in Phase 5, "explicitly reusable as-is on Phase 6's passport
 * page"). Every visual field comes straight from the stored DB row, never
 * re-randomized at render time — that's what makes a stamp's look stable
 * across reloads (QA 6.8).
 */
export function StampCard({
  stamp,
  onSelect,
}: {
  stamp: StampCardData;
  onSelect: (stamp: StampCardData) => void;
}) {
  return (
    <button
      type="button"
      data-testid="stamp-card"
      onClick={() => onSelect(stamp)}
      className="flex w-full min-h-11 flex-col items-center gap-s1 rounded-card p-s2 hover:bg-paper2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-horizon"
    >
      <PassportStamp
        stampStyle={stamp.stampStyle}
        rotationDeg={stamp.rotationDeg}
        inkHue={stamp.inkHue}
        city={stamp.city}
        countryIso={stamp.countryIso}
        dateLabel={stamp.dateLabel}
        size={110}
      />
    </button>
  );
}
