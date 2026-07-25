"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { remainingUntil } from "@/lib/countdown";
import { flipDigit } from "@/lib/motion/variants";

/*
 * Split-flap countdown (DS §8.4, WF §13): days:hrs:min:sec in Martian Mono.
 * Only the changed digits flip (each digit is keyed on its own value, so
 * Motion only animates a re-mount). Reduced motion: static digits, ticking
 * once a minute instead of every second, no flip transition. aria-live
 * announces only on a day-boundary crossing — never on second/minute ticks.
 */

export interface CountdownFlipProps {
  /** Departure instant, absolute (epoch ms). */
  targetUtcMs: number;
  /** Server-computed "now" for a hydration-safe first paint. */
  initialNowUtcMs: number;
  className?: string;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/*
 * `data-flap-current` marks the char that's actually settled (as opposed to
 * a previous char still mid-exit under AnimatePresence) — both stay in the
 * DOM during the crossfade, but only the current one should count toward
 * "what number is displayed" for anything reading the DOM programmatically.
 */
function FlapChar({ char }: { char: string }) {
  const isPresent = useIsPresent();
  return (
    <motion.span
      variants={flipDigit}
      initial="hidden"
      animate="visible"
      exit="exit"
      data-flap-current={isPresent}
      className="inline-block"
      style={{ transformOrigin: "50% 50%" }}
    >
      {char}
    </motion.span>
  );
}

function SplitFlapChar({ char, reduced }: { char: string; reduced: boolean }) {
  if (reduced) {
    return <span className="inline-block tabular-nums">{char}</span>;
  }
  return (
    <span
      aria-hidden
      className="relative inline-block overflow-hidden tabular-nums"
      style={{ perspective: 240 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <FlapChar key={char} char={char} />
      </AnimatePresence>
    </span>
  );
}

function DigitGroup({
  value,
  width,
  reduced,
}: {
  value: number;
  width: number;
  reduced: boolean;
}) {
  const chars = pad(value, width).split("");
  return (
    <span className="inline-flex" aria-hidden={reduced ? undefined : true}>
      {chars.map((char, index) => (
        <SplitFlapChar key={index} char={char} reduced={reduced} />
      ))}
    </span>
  );
}

function CountdownField({
  label,
  value,
  width,
  reduced,
}: {
  label: string;
  value: number;
  width: number;
  reduced: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span
        data-testid={`countdown-field-${label}`}
        className="ticket-surface flex gap-0.5 px-s3 py-s2 font-mono text-xl font-bold sm:text-2xl"
      >
        <DigitGroup value={value} width={width} reduced={reduced} />
      </span>
      <span className="font-mono text-[10px] tracking-widest text-ink-soft uppercase">
        {label}
      </span>
    </span>
  );
}

export function CountdownFlip({
  targetUtcMs,
  initialNowUtcMs,
  className,
}: CountdownFlipProps) {
  const { reduced } = useMotionPrefs();
  const [nowMs, setNowMs] = useState(initialNowUtcMs);
  const prevDaysRef = useRef<number | null>(null);
  const [dayFlourish, setDayFlourish] = useState(false);
  const [announceText, setAnnounceText] = useState("");

  const remaining = remainingUntil(targetUtcMs, nowMs);

  useEffect(() => {
    const tickMs = reduced ? 60_000 : 1000;
    const timer = setInterval(() => setNowMs(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [reduced]);

  useEffect(() => {
    const isFirstRun = prevDaysRef.current === null;
    const dayChanged = !isFirstRun && remaining.days !== prevDaysRef.current;

    if (isFirstRun || dayChanged) {
      setAnnounceText(
        remaining.days === 1
          ? "1 day until departure"
          : `${remaining.days} days until departure`,
      );
    }
    if (dayChanged && !reduced) {
      setDayFlourish(true);
      const timer = setTimeout(() => setDayFlourish(false), 900);
      prevDaysRef.current = remaining.days;
      return () => clearTimeout(timer);
    }
    prevDaysRef.current = remaining.days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.days]);

  return (
    <div
      data-testid="countdown-flip"
      className={`relative flex items-center gap-s3 ${className ?? ""}`}
    >
      {dayFlourish ? (
        <span
          aria-hidden
          data-testid="day-rollover-flourish"
          className="pointer-events-none absolute inset-0 z-10 opacity-50"
          style={{
            background:
              "linear-gradient(120deg, transparent 30%, var(--gold) 50%, transparent 70%)",
          }}
        />
      ) : null}
      <CountdownField
        label="days"
        value={remaining.days}
        width={remaining.days > 99 ? 3 : 2}
        reduced={reduced}
      />
      <CountdownField label="hrs" value={remaining.hours} width={2} reduced={reduced} />
      <CountdownField label="min" value={remaining.minutes} width={2} reduced={reduced} />
      <CountdownField label="sec" value={remaining.seconds} width={2} reduced={reduced} />
      <span
        aria-live="polite"
        className="sr-only"
        data-testid="countdown-aria-live"
      >
        {announceText}
      </span>
    </div>
  );
}
