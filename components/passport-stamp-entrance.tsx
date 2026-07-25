"use client";

import { useEffect, useRef } from "react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { PassportStamp, type PassportStampProps } from "@/components/passport-stamp";

/*
 * Passport stamp entrance (DS §8.3): wind-up (rotate + scale, slight
 * overshoot), thumps down with a soft dust-puff, settles at the stamp's own
 * `rotationDeg`. Plays only for the stamp arriving fresh from a booking
 * (`autoPlay`) — every other stamp, and any stamp under reduced motion,
 * appears instantly. GSAP is dynamic-imported (same pattern as
 * boarding-pass-reveal.tsx) so it stays out of the initial bundle.
 *
 * The wrapper animates an EXTRA rotation that resolves to 0 by the end of
 * the timeline — PassportStamp's own SVG already bakes in `rotationDeg` as
 * a static transform, so the settled state is exactly that angle, not
 * double-applied.
 */

export function PassportStampEntrance({
  stamp,
  autoPlay,
}: {
  stamp: PassportStampProps;
  autoPlay: boolean;
}) {
  const { reduced } = useMotionPrefs();
  const wrapRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef(false);

  const shouldAnimate = autoPlay && !reduced;

  useEffect(() => {
    if (!shouldAnimate || playedRef.current) return;
    let alive = true;
    playedRef.current = true;

    void import("gsap").then(({ gsap }) => {
      if (!alive || !wrapRef.current) return;
      gsap
        .timeline()
        .fromTo(
          wrapRef.current,
          { scale: 0.4, rotate: -25, opacity: 0 },
          { scale: 1.15, rotate: 6, opacity: 1, duration: 0.35, ease: "power2.in" },
        )
        .to(wrapRef.current, {
          scale: 1,
          rotate: 0,
          duration: 0.3,
          ease: "back.out(2.5)",
        })
        .fromTo(
          dustRef.current,
          { opacity: 0.55, scale: 0.6 },
          { opacity: 0, scale: 1.7, duration: 0.4 },
          "<",
        );
    });

    return () => {
      alive = false;
    };
  }, [shouldAnimate]);

  if (!shouldAnimate) {
    return <PassportStamp {...stamp} />;
  }

  return (
    <div className="relative inline-block">
      <div
        ref={dustRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-ink/10 opacity-0"
      />
      <div ref={wrapRef} className="opacity-0">
        <PassportStamp {...stamp} />
      </div>
    </div>
  );
}
