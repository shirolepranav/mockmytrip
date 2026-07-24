"use client";

import { useEffect, useRef } from "react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * THE signature loader (DS §8.1): a split-flap solari board flickering
 * through characters before results arrive. GSAP is dynamic-imported so it
 * never lands in the initial bundle. Reduced motion: calm static skeleton.
 */

const BOARD_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789···";
const ROW_TEMPLATES = [
  "FINDING DEPARTURES···",
  "CHECKING GATES·······",
  "PRICING DREAMS·······",
  "STAMPING PASSPORT····",
  "BOARDING SOON········",
  "ALMOST THERE·········",
];

function randomChar(): string {
  return BOARD_CHARS[Math.floor(Math.random() * BOARD_CHARS.length)];
}

export function DepartureBoard({ rows = 6 }: { rows?: number }) {
  const { reduced } = useMotionPrefs();
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !boardRef.current) return;
    let alive = true;
    const timers: ReturnType<typeof setInterval>[] = [];

    void import("gsap").then(({ gsap }) => {
      if (!alive || !boardRef.current) return;
      const rowElements = Array.from(
        boardRef.current.querySelectorAll<HTMLElement>("[data-board-row]"),
      );
      gsap.fromTo(
        rowElements,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.3, ease: "power2.out" },
      );
      // Each cell flickers through glyphs, settling left-to-right.
      rowElements.forEach((row, rowIndex) => {
        const target = row.dataset.boardText ?? "";
        const cells = Array.from(
          row.querySelectorAll<HTMLElement>("[data-board-cell]"),
        );
        cells.forEach((cell, cellIndex) => {
          const settleAt =
            Date.now() + 500 + rowIndex * 220 + cellIndex * 55;
          const timer = setInterval(() => {
            if (Date.now() >= settleAt) {
              cell.textContent = target[cellIndex] ?? "·";
              clearInterval(timer);
              return;
            }
            cell.textContent = randomChar();
          }, 50);
          timers.push(timer);
        });
      });
    });

    return () => {
      alive = false;
      timers.forEach(clearInterval);
    };
  }, [reduced]);

  const templates = ROW_TEMPLATES.slice(0, rows);

  if (reduced) {
    return (
      <div
        role="status"
        aria-label="Loading flights"
        data-testid="board-skeleton"
        className="ticket-surface rounded-sharp p-s4"
      >
        <p className="font-mono text-sm tracking-widest text-ink-soft uppercase">
          Finding your flights…
        </p>
        <div className="mt-s3 space-y-s2">
          {templates.map((_, index) => (
            <div
              key={index}
              className="h-6 rounded-sharp bg-line opacity-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      role="status"
      aria-label="Loading flights"
      data-testid="departure-board"
      className="rounded-sharp border border-line bg-ink p-s4 shadow-e2"
    >
      <p className="mb-s3 font-mono text-xs tracking-widest text-gold uppercase">
        ✦ Wanderlost departures
      </p>
      <div className="space-y-s2">
        {templates.map((template, rowIndex) => (
          <p
            key={rowIndex}
            data-board-row
            data-board-text={template}
            className="font-mono text-sm leading-none tracking-wider text-paper opacity-0 sm:text-base"
            aria-hidden
          >
            {template.split("").map((_, cellIndex) => (
              <span key={cellIndex} data-board-cell className="inline-block w-[1ch]">
                ·
              </span>
            ))}
          </p>
        ))}
      </div>
      <span className="sr-only">Searching for flights…</span>
    </div>
  );
}
