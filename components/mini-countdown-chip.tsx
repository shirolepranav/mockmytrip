"use client";

import { useCountdown } from "@/lib/hooks/use-countdown";

/*
 * Small ticking pill for an upcoming TripCard (WF §12). Card-grid scale
 * doesn't need per-second precision, so it always ticks once a minute —
 * clamped to >= 0 by useCountdown, so "Departs today" (never a negative
 * count) is the natural end state.
 */

export function MiniCountdownChip({
  targetUtcMs,
  nowUtcMs,
  className,
}: {
  targetUtcMs: number;
  nowUtcMs: number;
  className?: string;
}) {
  const { remainingMs, days, hours } = useCountdown(targetUtcMs, nowUtcMs, 60_000);

  return (
    <span
      data-testid="mini-countdown-chip"
      className={`inline-flex items-center rounded-pill border border-line bg-paper2 px-s2 py-0.5 font-mono text-xs text-ink-soft ${className ?? ""}`}
    >
      {remainingMs === 0 ? "Departs today" : `${days}d ${hours}h`}
    </span>
  );
}
