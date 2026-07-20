"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { sheetUp, sheetUpReduced } from "@/lib/motion/variants";
import { IconClose } from "@/components/icons";

/*
 * The persistent SIMULATION badge (golden rule #2 — never remove or hide).
 * Pinned on every (app) route. Tapping opens a plain-language explainer sheet.
 */

export function SimulationBadge() {
  const [open, setOpen] = useState(false);
  const { reduced } = useMotionPrefs();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the sheet when it opens; Escape closes it.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-testid="simulation-badge"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="press-physical fixed top-[var(--space-3)] right-[var(--space-3)] z-40 flex min-h-11 items-center gap-s1 rounded-pill border border-line bg-paper2 px-s3 py-s1 font-mono text-xs font-semibold tracking-widest text-stamp-red uppercase shadow-e1"
      >
        <span
          aria-hidden
          className="inline-block size-2 rounded-pill bg-stamp-red"
        />
        Simulation
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="simulation-explainer-title"
              variants={reduced ? sheetUpReduced : sheetUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
              className="ticket-surface w-full max-w-md rounded-t-biglg p-s5 pb-[calc(var(--space-6)+var(--safe-bottom))] shadow-e3 md:rounded-biglg md:pb-s5"
            >
              <div className="flex items-start justify-between gap-s3">
                <h2
                  id="simulation-explainer-title"
                  className="font-display text-xl"
                >
                  Everything here is a beautiful lie
                </h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close explainer"
                  className="flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper"
                >
                  <IconClose size={20} />
                </button>
              </div>
              <div className="mt-s3 space-y-s3 text-ink-soft">
                <p>
                  Wanderlost is a travel <strong>simulation</strong>. No real
                  flights, no real hotels, no payment — ever. The airlines are
                  fictional, the prices are synthetic, and checkout is always
                  $0.00.
                </p>
                <p>
                  What&apos;s real: the joy of planning. Research shows
                  anticipating a trip makes people happier than taking one.
                  That&apos;s the whole product.
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
