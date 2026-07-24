"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * Minimal single-banner toast (DS §9) — top-positioned, auto-dismissing,
 * no queue/context (one at a time is all Phase 5 needs: the email-skip
 * notice on the confirmation page).
 */
export function Toast({
  message,
  tone = "info",
  durationMs = 6000,
}: {
  message: string;
  tone?: "info" | "success";
  durationMs?: number;
}) {
  const { reduced } = useMotionPrefs();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="toast"
          role="status"
          data-testid="toast"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          className={`ticket-surface fixed top-[var(--space-3)] left-1/2 z-50 max-w-sm -translate-x-1/2 px-s4 py-s3 text-center text-sm font-semibold shadow-e2 ${
            tone === "success" ? "text-mint-ok" : "text-ink"
          }`}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
