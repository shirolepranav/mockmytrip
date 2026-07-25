"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * Toast with an action button (WF §14: "delete with undo toast"). A sibling
 * of components/toast.tsx rather than an extension of it — its lifecycle is
 * driven by the parent (an 8s deferred-delete window), not self-timed.
 */
export function UndoToast({
  visible,
  message,
  onUndo,
}: {
  visible: boolean;
  message: string;
  onUndo: () => void;
}) {
  const { reduced } = useMotionPrefs();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="undo-toast"
          role="status"
          data-testid="undo-toast"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          className="ticket-surface fixed top-[var(--space-3)] left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-s3 px-s4 py-s3 text-sm font-semibold shadow-e2"
        >
          <span className="min-w-0 truncate">{message}</span>
          <button
            type="button"
            onClick={onUndo}
            data-testid="undo-toast-action"
            className="min-h-11 shrink-0 rounded-pill bg-ink px-s3 text-paper2"
          >
            Undo
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
