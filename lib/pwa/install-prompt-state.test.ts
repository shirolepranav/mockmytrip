import { beforeEach, describe, expect, it } from "vitest";
import {
  hasFirstBoardingPass,
  isDismissSuppressed,
  markFirstBoardingPass,
  recordDismissal,
} from "./install-prompt-state";

/*
 * @phase8 install-prompt gating (QA 8.5): the first-boarding-pass flag is
 * idempotent, and a dismissal suppresses the prompt for exactly 30 days.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
});

describe("@phase8 markFirstBoardingPass / hasFirstBoardingPass", () => {
  it("is false before any boarding pass is marked", () => {
    expect(hasFirstBoardingPass()).toBe(false);
  });

  it("becomes true after marking, and stays true", () => {
    markFirstBoardingPass();
    expect(hasFirstBoardingPass()).toBe(true);
  });

  it("is idempotent — the first call wins, a later call doesn't overwrite it", () => {
    markFirstBoardingPass(1000);
    markFirstBoardingPass(2000);
    expect(window.localStorage.getItem("wanderlost.first-boarding-pass-at")).toBe("1000");
  });
});

describe("@phase8 recordDismissal / isDismissSuppressed", () => {
  it("is not suppressed before any dismissal", () => {
    expect(isDismissSuppressed()).toBe(false);
  });

  it("is suppressed immediately after a dismissal", () => {
    const now = 10_000_000;
    recordDismissal(now);
    expect(isDismissSuppressed(now)).toBe(true);
    expect(isDismissSuppressed(now + DAY_MS)).toBe(true);
  });

  it("stops being suppressed after 30 days", () => {
    const now = 10_000_000;
    recordDismissal(now);
    expect(isDismissSuppressed(now + 30 * DAY_MS - 1)).toBe(true);
    expect(isDismissSuppressed(now + 30 * DAY_MS + 1)).toBe(false);
  });
});
