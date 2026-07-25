"use client";

import { useState } from "react";
import { PassportStampEntrance } from "@/components/passport-stamp-entrance";
import { StampDetailSheet } from "@/components/stamp-detail-sheet";

export interface StampCardData {
  id: string;
  stampStyle: number;
  rotationDeg: number;
  inkHue: number;
  city: string;
  countryIso: string;
  dateLabel: string;
}

/* Stamp grid (WF §16): deterministic StampCards, tap opens the detail sheet. */
export function StampGrid({
  stamps,
  justStampedId,
}: {
  stamps: StampCardData[];
  justStampedId?: string;
}) {
  const [selected, setSelected] = useState<StampCardData | null>(null);

  return (
    <>
      <div
        data-testid="stamp-grid"
        className="grid grid-cols-2 gap-s4 sm:grid-cols-3"
      >
        {stamps.map((stamp) => (
          <button
            key={stamp.id}
            type="button"
            data-testid="stamp-card"
            onClick={() => setSelected(stamp)}
            className="ticket-surface flex flex-col items-center gap-s2 p-s4 hover:shadow-e2"
          >
            <PassportStampEntrance
              stamp={stamp}
              autoPlay={stamp.id === justStampedId}
            />
            <span className="truncate text-xs font-semibold text-ink-soft">
              {stamp.city}
            </span>
          </button>
        ))}
      </div>
      <StampDetailSheet stamp={selected} onClose={() => setSelected(null)} />
    </>
  );
}
