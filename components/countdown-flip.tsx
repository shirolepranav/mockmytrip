"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { durations, easings, springBouncy } from "@/lib/motion/tokens";
import { formatDateInTz, formatTimeInTz, isoDateInTz } from "@/lib/format";

/*
 * Split-flap countdown (DS §8.4): days:hrs:min:sec in Martian Mono. Only
 * the seconds flap animates every tick; the days flap gets a richer
 * "flourish" but only on a genuine day rollover (never on mount). A single
 * sr-only aria-live region announces day changes only — its text is a pure
 * function of `days`, so React (and thus the screen reader) only touches
 * that node on an actual day change, never every second (QA 6.4/6.11).
 *
 * The trip-detail PAGE never mounts this component at all once a trip's
 * status is "memory" — that page-level past-dated guard is what makes a
 * negative countdown structurally impossible, not a check in here. This
 * component's own half of that guarantee: remainingMs is clamped to >= 0 by
 * useCountdown, and the instant it hits 0 this component stops rendering
 * digits and switches to the "Bon voyage!" phase.
 */

const DAY_MS = 86_400_000;

export interface CountdownFlipProps {
  /** The outbound flight's departure instant (UTC ms) — the target. */
  targetUtcMs: number;
  /** The trip's end date (UTC ms) — used only to size "day N of your trip". */
  endUtcMs: number;
  /** Origin airport's IANA tz — what makes the local-time label correct. */
  originTz: string;
  destinationCity: string;
  /** Server-computed "now", for a hydration-safe first paint. */
  nowUtcMs: number;
  className?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function FlapShell({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-s1">
      <div
        data-testid={testId}
        className="ticket-surface flex min-w-14 items-center justify-center overflow-hidden rounded-sharp px-s2 py-s2 shadow-e2 sm:min-w-16"
      >
        {children}
      </div>
      <span className="font-mono text-[10px] tracking-widest text-ink-soft uppercase">
        {label}
      </span>
    </div>
  );
}

function DigitText({ value }: { value: string }) {
  return (
    <span className="block font-mono text-2xl leading-none font-bold tabular-nums text-ink sm:text-3xl">
      {value}
    </span>
  );
}

/** Hours/minutes: value updates every render, no per-tick animation. */
function StaticFlap({ value, label, testId }: { value: number; label: string; testId: string }) {
  return (
    <FlapShell label={label} testId={testId}>
      <DigitText value={pad2(value)} />
    </FlapShell>
  );
}

/** Seconds: a quick flip every single tick — "only seconds animate continuously". */
function SecondsFlap({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <FlapShell label="Sec" testId="countdown-flap-seconds">
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={reduced ? false : { opacity: 0, rotateX: -90 }}
          animate={{ opacity: 1, rotateX: 0 }}
          exit={reduced ? undefined : { opacity: 0, rotateX: 90 }}
          transition={{ duration: reduced ? 0 : durations.micro, ease: easings.standard }}
          style={{ transformOrigin: "50% 50%" }}
        >
          <DigitText value={pad2(value)} />
        </motion.span>
      </AnimatePresence>
    </FlapShell>
  );
}

/** Days: animates only on an actual rollover (AnimatePresence keyed by
 *  value + initial={false} means it never fires on mount). */
function DaysFlap({ value, reduced, flourish }: { value: number; reduced: boolean; flourish: boolean }) {
  return (
    <FlapShell label="Days" testId="countdown-flap-days">
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          data-testid={flourish ? "countdown-day-rollover" : undefined}
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{
            opacity: 1,
            scale: 1,
            textShadow: reduced || !flourish ? "none" : "0 0 14px var(--gold)",
          }}
          transition={reduced ? { duration: 0 } : springBouncy}
          style={{ transformOrigin: "50% 50%" }}
        >
          <DigitText value={String(value)} />
        </motion.span>
      </AnimatePresence>
    </FlapShell>
  );
}

export function CountdownFlip({
  targetUtcMs,
  endUtcMs,
  originTz,
  destinationCity,
  nowUtcMs,
  className,
}: CountdownFlipProps) {
  const { reduced } = useMotionPrefs();
  const { nowUtcMs: tickedNow, remainingMs, days, hours, minutes, seconds } =
    useCountdown(targetUtcMs, nowUtcMs, reduced ? 60_000 : 1000);

  // Flag a brief flourish window on a genuine day rollover only — never on
  // mount, since `prevDays` starts equal to the first render's `days`.
  // Adjusting state during render (React's documented pattern for reacting
  // to a prop/derived-value change) rather than in an effect — this fires
  // in the same render as the change, so it's immune to the timing games
  // an effect + rAF would otherwise need. The auto-clear below is a
  // genuine external-timer effect, not a synchronous-in-effect setState.
  const [prevDays, setPrevDays] = useState(days);
  const [rollover, setRollover] = useState(false);
  if (prevDays !== days) {
    setPrevDays(days);
    if (!reduced) setRollover(true);
  }
  useEffect(() => {
    if (!rollover) return;
    const timer = setTimeout(() => setRollover(false), 900);
    return () => clearTimeout(timer);
  }, [rollover]);

  const upcoming = remainingMs > 0;
  const dayLabel = `${days} day${days === 1 ? "" : "s"} to go`;
  const groupLabel = upcoming
    ? `Countdown to departure: ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`
    : `Departed`;

  if (!upcoming) {
    const totalTripDays = Math.max(1, Math.round((endUtcMs - targetUtcMs) / DAY_MS) + 1);
    const dayOfTrip = Math.min(
      totalTripDays,
      Math.floor((tickedNow - targetUtcMs) / DAY_MS) + 1,
    );
    const isDepartureDay = isoDateInTz(tickedNow, originTz) === isoDateInTz(targetUtcMs, originTz);
    return (
      <div
        data-testid="countdown-bon-voyage"
        className={`ticket-surface flex flex-col items-center gap-s1 rounded-card p-s5 text-center ${className ?? ""}`}
      >
        <p className="font-display text-2xl">Bon voyage!</p>
        <p className="text-ink-soft">
          {isDepartureDay
            ? `You're off to ${destinationCity}!`
            : `Day ${dayOfTrip} of ${totalTripDays} — still soaking up ${destinationCity}.`}
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-testid="countdown-flip"
      className={`flex flex-col items-center gap-s3 ${className ?? ""}`}
    >
      <div aria-hidden className="flex items-center gap-s2">
        <DaysFlap value={days} reduced={reduced} flourish={rollover} />
        <span className="pb-s4 font-mono text-xl text-ink-soft">:</span>
        <StaticFlap value={hours} label="Hrs" testId="countdown-flap-hours" />
        <span className="pb-s4 font-mono text-xl text-ink-soft">:</span>
        <StaticFlap value={minutes} label="Min" testId="countdown-flap-minutes" />
        <span className="pb-s4 font-mono text-xl text-ink-soft">:</span>
        <SecondsFlap value={seconds} reduced={reduced} />
      </div>
      <span aria-live="polite" className="sr-only">
        {dayLabel}
      </span>
      <p className="text-sm text-ink-soft">
        Departs {formatDateInTz(targetUtcMs, originTz)} ·{" "}
        {formatTimeInTz(targetUtcMs, originTz)} local time
      </p>
    </div>
  );
}
