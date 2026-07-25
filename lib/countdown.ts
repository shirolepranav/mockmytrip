import { isoDateInTz } from "@/lib/format";

/*
 * Pure countdown math (docs/DESIGN_SYSTEM.md §8.4, WF §13). Both inputs are
 * absolute instants (epoch ms), so the breakdown below is inherently
 * timezone-correct without any tz-aware arithmetic — tz only matters for
 * the accompanying human-readable date/day-boundary logic, handled
 * separately via isDepartureDay.
 */

export interface RemainingBreakdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Time remaining until `targetUtcMs`, clamped at zero — never negative. */
export function remainingUntil(
  targetUtcMs: number,
  nowUtcMs: number,
): RemainingBreakdown {
  const totalMs = Math.max(0, targetUtcMs - nowUtcMs);
  const days = Math.floor(totalMs / DAY_MS);
  const hours = Math.floor((totalMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((totalMs % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((totalMs % MINUTE_MS) / SECOND_MS);
  return { days, hours, minutes, seconds, totalMs };
}

/** True when `nowUtcMs` and `startUtcMs` fall on the same calendar day in `tz`. */
export function isDepartureDay(
  nowUtcMs: number,
  startUtcMs: number,
  tz: string,
): boolean {
  return isoDateInTz(nowUtcMs, tz) === isoDateInTz(startUtcMs, tz);
}

/**
 * The current instant, epoch ms. A tiny indirection so Server Components
 * (which legitimately read the wall clock once per request) don't read
 * `Date.now()` directly in their render body — eslint's purity rule treats
 * that as an impure call inside a component, which is the right default for
 * client render bodies but not for a one-shot server render.
 */
export function currentTimeMs(): number {
  return Date.now();
}
