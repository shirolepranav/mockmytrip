"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { PassportStamp } from "@/components/passport-stamp";
import type { StampCardData } from "@/components/stamp-grid";

/* Tap-to-detail sheet for a passport stamp (WF §16). */
export function StampDetailSheet({
  stamp,
  onClose,
}: {
  stamp: StampCardData | null;
  onClose: () => void;
}) {
  // Retains the last-selected stamp through the sheet's close animation, so
  // the content doesn't blank out mid-exit-transition. Adjusted during
  // render (React's sanctioned "derive state from props" pattern) rather
  // than in an effect, since it only needs to run when `stamp` itself
  // changes and must be visible on the very same render.
  const [displayStamp, setDisplayStamp] = useState<StampCardData | null>(stamp);
  if (stamp !== null && stamp !== displayStamp) {
    setDisplayStamp(stamp);
  }

  return (
    <Sheet
      open={stamp !== null}
      onClose={onClose}
      title={displayStamp ? `${displayStamp.city}, ${displayStamp.countryIso}` : undefined}
      testId="stamp-detail-sheet"
    >
      {displayStamp ? (
        <div className="flex flex-col items-center gap-s3 py-s3">
          <PassportStamp {...displayStamp} size={140} />
          <p className="text-sm text-ink-soft">Stamped {displayStamp.dateLabel}</p>
        </div>
      ) : null}
    </Sheet>
  );
}
