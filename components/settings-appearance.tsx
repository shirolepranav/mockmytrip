"use client";

import { useMotionPrefs, type MotionOverride } from "@/lib/motion/reduced-motion";
import { useTheme } from "@/components/theme-provider";

/*
 * Reduced-motion + theme controls (Phase 8 task 6). Both providers
 * (MotionProvider, ThemeProvider) already existed fully wired since Phase
 * 0 — this is the first UI that actually calls setOverride/setTheme.
 * localStorage-only per the Phase 8 plan (device-level display
 * preferences; no prefs_json round-trip needed for either).
 */

const MOTION_OPTIONS: { value: MotionOverride; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "full", label: "Full motion" },
  { value: "reduced", label: "Reduced" },
];

export function SettingsAppearance() {
  const { override, setOverride } = useMotionPrefs();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-s5">
      <div className="flex flex-col gap-s2">
        <span className="text-sm font-semibold">Motion</span>
        <div
          role="radiogroup"
          aria-label="Motion preference"
          className="flex w-full gap-s1 rounded-pill border border-line bg-paper2 p-s1"
        >
          {MOTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={override === option.value}
              data-testid={`motion-option-${option.value}`}
              onClick={() => setOverride(option.value)}
              className={`min-h-11 flex-1 rounded-pill font-semibold ${
                override === option.value ? "bg-ink text-paper2" : "text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-s2">
        <span className="text-sm font-semibold">Theme</span>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex w-full gap-s1 rounded-pill border border-line bg-paper2 p-s1"
        >
          {(
            [
              { value: "light", label: "Light" },
              { value: "night", label: "Night flight" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              data-testid={`theme-option-${option.value}`}
              onClick={() => setTheme(option.value)}
              className={`min-h-11 flex-1 rounded-pill font-semibold ${
                theme === option.value ? "bg-ink text-paper2" : "text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
