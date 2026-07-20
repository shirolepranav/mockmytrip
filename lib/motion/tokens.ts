/*
 * Motion tokens (docs/DESIGN_SYSTEM.md §7).
 * Every animated component pulls durations/easings/springs from here so the
 * whole app moves with one physical personality.
 */

/** Durations in seconds (Motion uses seconds). */
export const durations = {
  micro: 0.15, // taps, ticks: 120–180ms
  ui: 0.28, // standard UI in/out: 220–320ms
  setPiece: 0.9, // orchestrated set-pieces: 600–1200ms
} as const;

/** Cubic-bezier easings, mirrored from the CSS variables. */
export const easings = {
  standard: [0.2, 0.7, 0.2, 1],
  outExpo: [0.16, 1, 0.3, 1],
  outBack: [0.34, 1.56, 0.64, 1],
  inBack: [0.36, 0, 0.66, -0.56],
} as const;

/** Spring configs for Motion components. */
export const springSoft = {
  type: "spring",
  stiffness: 260,
  damping: 24,
} as const;

export const springBouncy = {
  type: "spring",
  stiffness: 420,
  damping: 14,
} as const;

export const springHeavy = {
  type: "spring",
  stiffness: 180,
  damping: 30,
} as const;

/** Stagger interval for list entrances (40–60ms). */
export const listStagger = 0.05;
