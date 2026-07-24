"use client";

import { useEffect, useRef } from "react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { BoardingPass } from "@/components/boarding-pass";
import { PassportStamp } from "@/components/passport-stamp";
import type { BoardingPassData } from "@/lib/boarding-pass-view";

/*
 * The boarding-pass reveal set-piece (DS §8.2): pass slides up, stamp
 * thumps (scale 1.6→1 ease-in-back + micro shake), capped confetti burst,
 * gold shimmer sweep. GSAP + canvas-confetti are dynamic-imported (same
 * pattern as components/departure-board.tsx) so they stay out of the
 * initial bundle. Plays once, only on a fresh booking (`autoPlay`) — a
 * revisit of the confirmation page always renders the settled state, and
 * reduced-motion always collapses to an instant pass + static graphic/text.
 */

const MAX_CONFETTI_PARTICLES = 150;

export interface StampVisual {
  stampStyle: number;
  rotationDeg: number;
  inkHue: number;
  city: string;
  countryIso: string;
  dateLabel: string;
}

function StaticCelebrationGraphic() {
  const dots = [
    { x: 16, y: 10, r: 4, color: "var(--gold)" },
    { x: 60, y: 6, r: 3, color: "var(--sunset)" },
    { x: 38, y: 22, r: 5, color: "var(--horizon)" },
    { x: 84, y: 20, r: 3, color: "var(--gold)" },
    { x: 8, y: 30, r: 3, color: "var(--sunset)" },
    { x: 56, y: 32, r: 4, color: "var(--horizon)" },
  ];
  return (
    <svg aria-hidden width="100" height="40" viewBox="0 0 100 40">
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} />
      ))}
    </svg>
  );
}

export function BoardingPassReveal({
  data,
  stamp,
  autoPlay,
}: {
  data: BoardingPassData;
  stamp: StampVisual;
  autoPlay: boolean;
}) {
  const { reduced } = useMotionPrefs();
  const passRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  // Plain ref, not state: this is an internal once-only guard, not a value
  // the render output depends on, so it shouldn't trigger a re-render
  // (also avoids a synchronous setState call in the effect body).
  const playedRef = useRef(false);

  const shouldAnimate = autoPlay && !reduced;

  useEffect(() => {
    if (!shouldAnimate || playedRef.current) return;
    let alive = true;
    playedRef.current = true;

    void Promise.all([import("gsap"), import("canvas-confetti")]).then(
      ([{ gsap }, confettiModule]) => {
        if (!alive || !passRef.current || !stampRef.current) return;
        const confetti = confettiModule.default;

        gsap
          .timeline()
          .fromTo(
            passRef.current,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
          )
          .fromTo(
            stampRef.current,
            { scale: 1.6, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)" },
            "-=0.15",
          )
          .to(
            shakeRef.current,
            { x: 3, duration: 0.05, yoyo: true, repeat: 3, ease: "power1.inOut" },
            "<",
          )
          .fromTo(
            shimmerRef.current,
            { opacity: 0 },
            { opacity: 0.5, duration: 0.2, yoyo: true, repeat: 1 },
            "-=0.1",
          );

        confetti({
          particleCount: MAX_CONFETTI_PARTICLES,
          spread: 70,
          startVelocity: 35,
          origin: { y: 0.4 },
        });
      },
    );

    return () => {
      alive = false;
    };
  }, [shouldAnimate]);

  if (!shouldAnimate) {
    return (
      <div
        data-testid="boarding-pass-reveal"
        className="flex flex-col items-center gap-s5"
      >
        {autoPlay ? (
          <div
            data-testid="reveal-static-celebration"
            className="flex flex-col items-center gap-s2"
          >
            <StaticCelebrationGraphic />
            <p className="font-display text-2xl">Booked! Welcome aboard.</p>
          </div>
        ) : null}
        <div className="w-full max-w-xl">
          <BoardingPass data={data} />
        </div>
        <PassportStamp {...stamp} size={96} />
      </div>
    );
  }

  return (
    <div
      ref={shakeRef}
      data-testid="boarding-pass-reveal"
      className="relative flex w-full max-w-xl flex-col items-center gap-s5"
    >
      <div
        ref={shimmerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-0"
        style={{
          background:
            "linear-gradient(120deg, transparent 30%, var(--gold) 50%, transparent 70%)",
        }}
      />
      <div ref={passRef} className="w-full opacity-0">
        <BoardingPass data={data} />
      </div>
      <div ref={stampRef} className="opacity-0">
        <PassportStamp {...stamp} size={96} />
      </div>
    </div>
  );
}
