"use client";

import { useMotionPrefs } from "@/lib/motion/reduced-motion";

/*
 * Accessible on/off switch (Phase 8 task 6), shared by the Settings
 * appearance/notifications sections. The thumb slide is a plain CSS
 * transform transition, gated directly on useMotionPrefs().reduced (no
 * Motion-library variant needed for a simple transform).
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  testId?: string;
}) {
  const { reduced } = useMotionPrefs();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border border-line p-0.5 disabled:opacity-50 ${
        checked ? "bg-horizon-deep" : "bg-paper2"
      }`}
    >
      <span
        aria-hidden
        className={`block size-6 rounded-pill bg-paper2 shadow-e1 ${
          checked ? "translate-x-5" : "translate-x-0"
        } ${reduced ? "" : "transition-transform duration-200"}`}
      />
    </button>
  );
}
