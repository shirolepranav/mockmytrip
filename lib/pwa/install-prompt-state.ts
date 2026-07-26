/*
 * Install-prompt gating state (Phase 8 task 3, WF §21: "contextual,
 * non-nagging, dismissible; only after a delightful moment"). Plain
 * localStorage helpers — this is a per-browser-instance UI gate with no
 * cross-device meaning, so there's no server round-trip involved.
 */

const FIRST_BOARDING_PASS_KEY = "wanderlost.first-boarding-pass-at";
const DISMISSED_AT_KEY = "wanderlost.install-prompt-dismissed-at";
const DISMISS_SUPPRESS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode) — the prompt just won't persist
    // across reloads this session, which is a safe, non-nagging fallback.
  }
}

/** Idempotent: the first call wins, later calls are no-ops. */
export function markFirstBoardingPass(nowMs = Date.now()): void {
  if (readItem(FIRST_BOARDING_PASS_KEY)) return;
  writeItem(FIRST_BOARDING_PASS_KEY, String(nowMs));
}

export function hasFirstBoardingPass(): boolean {
  return readItem(FIRST_BOARDING_PASS_KEY) !== null;
}

export function recordDismissal(nowMs = Date.now()): void {
  writeItem(DISMISSED_AT_KEY, String(nowMs));
}

export function isDismissSuppressed(nowMs = Date.now()): boolean {
  const raw = readItem(DISMISSED_AT_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return nowMs - dismissedAt < DISMISS_SUPPRESS_MS;
}
