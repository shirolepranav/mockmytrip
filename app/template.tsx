"use client";

import { motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { durations, easings } from "@/lib/motion/tokens";

/*
 * Page-transition wrapper: content enters with a subtle upward fade
 * (y:8→0, ~300ms). Under reduced motion the transition is instant.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const { reduced } = useMotionPrefs();

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: durations.ui, ease: easings.standard }
      }
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
