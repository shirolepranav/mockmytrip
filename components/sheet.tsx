"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { sheetUp, sheetUpReduced } from "@/lib/motion/variants";
import { IconClose } from "@/components/icons";

/*
 * Bottom-sheet primitive (DS §9 sheet pattern), first used by Phase 6's
 * stamp-detail sheet and reused by Phase 7's POI detail / day-picker sheets.
 * Slides up from the bottom, backdrop tap or Escape closes it, reduced
 * motion collapses the slide to an instant fade.
 */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testId?: string;
}

export function Sheet({ open, onClose, title, children, testId = "sheet" }: SheetProps) {
  const { reduced } = useMotionPrefs();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            aria-hidden
            data-testid={`${testId}-backdrop`}
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-testid={testId}
            variants={reduced ? sheetUpReduced : sheetUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="ticket-surface relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col gap-s4 overflow-y-auto rounded-t-lg p-s5 pb-[calc(var(--safe-bottom)+var(--space-5))]"
          >
            <div className="flex items-center justify-between gap-s3">
              {title ? (
                <h2 className="font-display text-lg">{title}</h2>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2"
              >
                <IconClose size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
