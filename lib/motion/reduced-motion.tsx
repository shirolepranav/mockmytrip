"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/*
 * Reduced-motion layer (docs/DESIGN_SYSTEM.md §7, hard requirement).
 * Combines the OS `prefers-reduced-motion` media query with a user override
 * stored in localStorage (wired to a Settings toggle in Phase 8).
 * ALL animation variants must route through useMotionPrefs().
 */

export type MotionOverride = "system" | "reduced" | "full";

const STORAGE_KEY = "wanderlost.motion-override";
const OVERRIDE_EVENT = "wanderlost:motion-override";

/* OS media-query store (SSR snapshot: not reduced). */
function subscribeToMediaQuery(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function readSystemReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* localStorage override store, synced across tabs and within this tab. */
function subscribeToOverride(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(OVERRIDE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(OVERRIDE_EVENT, callback);
  };
}

function readStoredOverride(): MotionOverride {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "reduced" || raw === "full" ? raw : "system";
  } catch {
    return "system";
  }
}

interface MotionPrefs {
  /** True when animations should collapse to instant/opacity-only. */
  reduced: boolean;
  /** The user's explicit override ("system" = follow the OS). */
  override: MotionOverride;
  setOverride: (value: MotionOverride) => void;
}

const MotionPrefsContext = createContext<MotionPrefs>({
  reduced: false,
  override: "system",
  setOverride: () => undefined,
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const systemReduced = useSyncExternalStore(
    subscribeToMediaQuery,
    readSystemReduced,
    () => false,
  );
  const override = useSyncExternalStore(
    subscribeToOverride,
    readStoredOverride,
    () => "system" as const,
  );

  const setOverride = useCallback((value: MotionOverride) => {
    try {
      if (value === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable (private mode) — the event still notifies.
    }
    window.dispatchEvent(new Event(OVERRIDE_EVENT));
  }, []);

  const reduced =
    override === "system" ? systemReduced : override === "reduced";

  // Expose the resolved preference to CSS (e.g. to pause CSS animations).
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  const value = useMemo<MotionPrefs>(
    () => ({ reduced, override, setOverride }),
    [reduced, override, setOverride],
  );

  return (
    <MotionPrefsContext.Provider value={value}>
      {children}
    </MotionPrefsContext.Provider>
  );
}

/** Read motion preferences anywhere below MotionProvider. */
export function useMotionPrefs(): MotionPrefs {
  return useContext(MotionPrefsContext);
}
