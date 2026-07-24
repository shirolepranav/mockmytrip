"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { IconClose } from "@/components/icons";
import { PassportStamp } from "@/components/passport-stamp";
import type { StampCardData } from "@/components/stamp-card";
import { formatMiles } from "@/lib/format";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { sheetUp, sheetUpReduced } from "@/lib/motion/variants";

/*
 * Stamp tap -> detail (WF §16). Copies simulation-badge.tsx's dialog
 * structure verbatim — the one established bottom-sheet pattern in this
 * codebase: overlay + sheetUp/sheetUpReduced, focus moved to the close
 * button on open, Escape closes, click-outside closes.
 */
export function StampDetailSheet({
  stamp,
  onClose,
}: {
  stamp: StampCardData | null;
  onClose: () => void;
}) {
  const { reduced } = useMotionPrefs();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!stamp) return;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stamp, onClose]);

  return (
    <AnimatePresence>
      {stamp ? (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center"
          onClick={onClose}
        >
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stamp-detail-title"
            data-testid="stamp-detail-sheet"
            variants={reduced ? sheetUpReduced : sheetUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(event) => event.stopPropagation()}
            className="ticket-surface w-full max-w-md rounded-t-biglg p-s5 pb-[calc(var(--space-6)+var(--safe-bottom))] shadow-e3 md:rounded-biglg md:pb-s5"
          >
            <div className="flex items-start justify-between gap-s3">
              <h2 id="stamp-detail-title" className="font-display text-xl">
                {stamp.city}, {stamp.countryIso}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close stamp detail"
                className="flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="mt-s4 flex flex-col items-center gap-s3">
              <PassportStamp
                stampStyle={stamp.stampStyle}
                rotationDeg={stamp.rotationDeg}
                inkHue={stamp.inkHue}
                city={stamp.city}
                countryIso={stamp.countryIso}
                dateLabel={stamp.dateLabel}
                size={200}
              />
              <p className="text-ink-soft">
                {stamp.dateLabel} · {formatMiles(stamp.distanceKm)} dreamed
              </p>
              {stamp.tripId ? (
                <Link
                  href={`/trips/${stamp.tripId}`}
                  className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
                >
                  View this trip
                </Link>
              ) : (
                <p className="text-sm text-ink-soft">
                  This trip is now just a memory.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
