"use client";

import { useEffect, useRef } from "react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import { IconPlane } from "@/components/icons";

/*
 * Hotel-results loader (WF §7's "paper-plane" loader variant), mirroring
 * DepartureBoard's contract: GSAP is dynamic-imported so it never lands in
 * the initial bundle. Reduced motion: calm static skeleton, no transforms.
 */

const LOADING_LINES = [
  "Scouting neighborhoods···",
  "Checking room rates·······",
  "Fluffing pillows··········",
  "Almost there···············",
];

export function PaperPlaneLoader({ cards = 4 }: { cards?: number }) {
  const { reduced } = useMotionPrefs();
  const planeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || !planeRef.current) return;
    let alive = true;
    let tween: { kill(): void } | undefined;

    void import("gsap").then(({ gsap }) => {
      if (!alive || !planeRef.current) return;
      tween = gsap.fromTo(
        planeRef.current,
        { x: -8, y: 6, rotate: -8 },
        {
          x: 8,
          y: -6,
          rotate: 8,
          duration: 1.1,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        },
      );
    });

    return () => {
      alive = false;
      tween?.kill();
    };
  }, [reduced]);

  if (reduced) {
    return (
      <div
        role="status"
        aria-label="Loading hotels"
        data-testid="plane-skeleton"
        className="flex flex-col gap-s3"
      >
        <p className="font-mono text-sm tracking-widest text-ink-soft uppercase">
          Finding your stay…
        </p>
        <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2">
          {Array.from({ length: cards }).map((_, index) => (
            <div
              key={index}
              className="ticket-surface flex flex-col gap-s2 p-s4"
            >
              <div className="h-32 rounded-card bg-line opacity-50" />
              <div className="h-4 w-2/3 rounded-sharp bg-line opacity-50" />
              <div className="h-3 w-1/2 rounded-sharp bg-line opacity-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading hotels"
      data-testid="paper-plane-loader"
      className="ticket-surface flex flex-col items-center gap-s4 p-s6"
    >
      <span ref={planeRef} className="inline-block text-horizon-deep">
        <IconPlane size={36} />
      </span>
      <div
        aria-hidden
        className="h-px w-2/3 border-t-2 border-dashed border-line"
      />
      <div className="space-y-s1 text-center">
        {LOADING_LINES.map((line) => (
          <p
            key={line}
            className="font-mono text-xs tracking-widest text-ink-soft uppercase"
          >
            {line}
          </p>
        ))}
      </div>
      <span className="sr-only">Searching for hotels…</span>
    </div>
  );
}
