"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * Scrubs the one-time `justStamped` query flag from the URL after mount, so
 * a manual refresh never replays the stamp entrance (mirrors
 * components/confirmation-effects.tsx).
 */
export function PassportEffects() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.replace(pathname);
    // Runs once on mount only — scrubbing is a one-time action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
