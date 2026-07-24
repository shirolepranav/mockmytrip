"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { PassportStamp } from "@/components/passport-stamp";
import { StampCard, type StampCardData } from "@/components/stamp-card";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { listItem, listItemReduced, staggerList, staggerListReduced } from "@/lib/motion/variants";

/*
 * Passport StampGrid (WF §16). Normal entrance uses the same
 * stagger/listItem convention as HotelResultsList/FlightResultsList. The
 * one stamp matching `entranceStampId` (arriving via ?justStamped=1 from a
 * fresh booking) instead plays a GSAP windup->thump->settle entrance,
 * following boarding-pass-reveal.tsx's exact dynamic-import +
 * played-once-guard + reduced-motion-instant pattern (DS §8.3).
 */

const DUST_PUFFS = [
  { x: -18, y: -6 },
  { x: 14, y: -14 },
  { x: 20, y: 8 },
  { x: -12, y: 14 },
];

function AnimatedStampEntrance({
  stamp,
  onSelect,
}: {
  stamp: StampCardData;
  onSelect: (stamp: StampCardData) => void;
}) {
  const stampRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const dustRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current || !stampRef.current) return;
    playedRef.current = true;
    let alive = true;

    void import("gsap").then(({ gsap }) => {
      if (!alive || !stampRef.current) return;
      gsap
        .timeline()
        .fromTo(
          stampRef.current,
          { rotate: stamp.rotationDeg - 55, scale: 0.5, opacity: 0 },
          { rotate: stamp.rotationDeg, scale: 1, opacity: 1, duration: 0.4, ease: "power2.in" },
        )
        .to(stampRef.current, { scale: 1.08, duration: 0.1, ease: "power1.out" })
        .to(stampRef.current, { scale: 1, duration: 0.25, ease: "back.out(2)" })
        .fromTo(
          inkRef.current,
          { opacity: 0.55, scale: 0.6 },
          { opacity: 0, scale: 1.6, duration: 0.5, ease: "power2.out" },
          "<",
        )
        // Dust puff: each speck fades in then drifts out and fades away.
        .to(
          dustRefs.current.filter(Boolean),
          { opacity: 0.5, duration: 0.12, stagger: 0.03, ease: "power1.out" },
          "<",
        )
        .to(
          dustRefs.current.filter(Boolean),
          {
            opacity: 0,
            x: (index: number) => DUST_PUFFS[index]?.x ?? 0,
            y: (index: number) => DUST_PUFFS[index]?.y ?? 0,
            duration: 0.35,
            stagger: 0.03,
            ease: "power1.out",
          },
          ">-0.05",
        );
    });

    return () => {
      alive = false;
    };
  }, [stamp.rotationDeg]);

  return (
    <li className="relative list-none">
      <button
        type="button"
        data-testid="stamp-card"
        onClick={() => onSelect(stamp)}
        className="relative flex min-h-11 w-full flex-col items-center gap-s1 rounded-card p-s2 hover:bg-paper2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-horizon"
      >
        <div
          ref={inkRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto size-24 rounded-full opacity-0"
          style={{ background: `radial-gradient(circle, hsl(${stamp.inkHue} 68% 40%) 0%, transparent 70%)` }}
        />
        {DUST_PUFFS.map((_, index) => (
          <span
            key={index}
            ref={(el) => {
              dustRefs.current[index] = el;
            }}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full bg-ink-soft opacity-0"
          />
        ))}
        <div ref={stampRef} style={{ opacity: 0 }}>
          <PassportStamp
            stampStyle={stamp.stampStyle}
            rotationDeg={stamp.rotationDeg}
            inkHue={stamp.inkHue}
            city={stamp.city}
            countryIso={stamp.countryIso}
            dateLabel={stamp.dateLabel}
            size={110}
          />
        </div>
      </button>
    </li>
  );
}

export function StampGrid({
  stamps,
  entranceStampId,
  onSelect,
}: {
  stamps: StampCardData[];
  entranceStampId?: string;
  onSelect: (stamp: StampCardData) => void;
}) {
  const { reduced } = useMotionPrefs();
  // Reduced motion (or no fresh booking to animate): every stamp renders
  // already-settled — no entrance animation branch at all (QA 6.9).
  const shouldAnimateEntrance = Boolean(entranceStampId) && !reduced;

  return (
    <motion.ul
      variants={reduced ? staggerListReduced : staggerList}
      initial="hidden"
      animate="visible"
      data-testid="stamp-grid"
      className="grid grid-cols-2 gap-s3 sm:grid-cols-3 md:grid-cols-4"
    >
      {stamps.map((stamp) =>
        shouldAnimateEntrance && stamp.id === entranceStampId ? (
          <AnimatedStampEntrance key={stamp.id} stamp={stamp} onSelect={onSelect} />
        ) : (
          <motion.li
            key={stamp.id}
            variants={reduced ? listItemReduced : listItem}
            className="list-none"
          >
            <StampCard stamp={stamp} onSelect={onSelect} />
          </motion.li>
        ),
      )}
    </motion.ul>
  );
}
