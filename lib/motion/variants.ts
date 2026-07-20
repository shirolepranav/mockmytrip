import type { Variants } from "motion/react";
import { durations, easings, listStagger } from "./tokens";

/*
 * Shared Motion variants. Each has a reduced twin — components pick via
 * useMotionPrefs().reduced. Reduced variants animate opacity only (or nothing).
 */

/** Standard content entrance: subtle upward fade. */
export const enterUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.ui, ease: easings.standard },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: durations.micro, ease: easings.standard },
  },
};

/** Reduced-motion twin of enterUp: instant, no transform. */
export const enterUpReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** Parent container that staggers list children in. */
export const staggerList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: listStagger } },
};

export const staggerListReduced: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
};

/** List item entrance used inside staggerList. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.ui, ease: easings.outExpo },
  },
};

export const listItemReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

/** Bottom-sheet slide-up. */
export const sheetUp: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.ui, ease: easings.outExpo },
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: { duration: durations.ui, ease: easings.standard },
  },
};

export const sheetUpReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};
