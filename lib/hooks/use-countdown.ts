"use client";

import { useEffect, useState } from "react";

/*
 * Shared, hydration-safe ticking primitive for CountdownFlip and
 * MiniCountdownChip (DS §8.4). `initialNowUtcMs` must be the server-computed
 * "now" passed down as a prop so the first client render matches the SSR
 * markup exactly; a useEffect (client-only, after hydration) resyncs to the
 * real clock and starts ticking. `remainingMs` is clamped to >= 0 here —
 * this is the hook-level half of the "no negative countdown" guarantee (the
 * other half is the page-level past-dated guard, which never mounts a
 * countdown at all for a memory-status trip).
 */

export interface CountdownState {
  /** The ticking "now" this state was computed from (clamped consumers
   *  derive their own phase logic — e.g. departure-day copy — from this). */
  nowUtcMs: number;
  remainingMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export function useCountdown(
  targetUtcMs: number,
  initialNowUtcMs: number,
  tickMs: number,
): CountdownState {
  const [now, setNow] = useState(initialNowUtcMs);

  useEffect(() => {
    // setState deferred to a rAF callback (not called synchronously in the
    // effect body) per react-hooks/set-state-in-effect — same pattern as
    // components/savings-tally.tsx.
    const sync = () => setNow(Date.now());
    const frame = requestAnimationFrame(sync);
    const id = setInterval(sync, tickMs);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, [tickMs]);

  const remainingMs = Math.max(0, targetUtcMs - now);
  return {
    nowUtcMs: now,
    remainingMs,
    days: Math.floor(remainingMs / DAY_MS),
    hours: Math.floor((remainingMs % DAY_MS) / HOUR_MS),
    minutes: Math.floor((remainingMs % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((remainingMs % MINUTE_MS) / 1000),
  };
}
