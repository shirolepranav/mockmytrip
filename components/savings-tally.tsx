"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { formatMoney } from "@/lib/format";

/*
 * "You're saving $X" count-up (DS §8.10): ease-out-expo tween from 0 to the
 * target, with a gentle gold glow once it settles. Reduced motion: jumps
 * straight to the final value, no glow transition.
 */

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const DURATION_MS = 800;

export function SavingsTally({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const { reduced } = useMotionPrefs();
  const [display, setDisplay] = useState(reduced ? cents : 0);
  const [settled, setSettled] = useState(reduced);
  const frameRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      // setState deferred to a rAF callback (not called synchronously in the
      // effect body) even for the instant case, per react-hooks/set-state-in-effect.
      frameRef.current = requestAnimationFrame(() => {
        setDisplay(cents);
        setSettled(true);
      });
      return () => cancelAnimationFrame(frameRef.current);
    }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setDisplay(Math.round(cents * easeOutExpo(progress)));
      setSettled(progress >= 1);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [cents, reduced]);

  return (
    <span
      data-testid="savings-tally"
      className={className}
      style={{
        textShadow: settled ? "0 0 14px var(--gold)" : "none",
        transition: reduced ? "none" : "text-shadow 400ms var(--ease-standard)",
      }}
    >
      {formatMoney(display)}
    </span>
  );
}
