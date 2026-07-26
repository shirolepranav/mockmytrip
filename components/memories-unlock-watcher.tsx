"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/*
 * Graceful in-session unlock (Phase 8 task 5, QA 8.8): if a trip's end date
 * passes while the locked Memories page is still open in a tab, refresh
 * once at that exact boundary so it flips to the unlocked recap without
 * requiring a manual reload. Mirrors CountdownFlip's server-now-plus-timer
 * pattern, but fires once via setTimeout rather than ticking every second.
 */
export function MemoriesUnlockWatcher({
  endDateMs,
  initialNowMs,
}: {
  endDateMs: number;
  initialNowMs: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const msUntilUnlock = endDateMs - initialNowMs;
    if (msUntilUnlock <= 0) {
      router.refresh();
      return;
    }
    // setTimeout clamps very large delays; a locked trip is always within
    // the countdown's realistic range (weeks/months), never years out.
    const timer = setTimeout(() => router.refresh(), msUntilUnlock);
    return () => clearTimeout(timer);
  }, [endDateMs, initialNowMs, router]);

  return null;
}
