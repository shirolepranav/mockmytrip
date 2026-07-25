import { describe, expect, it } from "vitest";
import { isDepartureDay, remainingUntil } from "./countdown";

describe("@phase6 remainingUntil", () => {
  it("6.3 breaks down an exact delta correctly", () => {
    const now = Date.parse("2026-08-05T04:30:15Z");
    const target = Date.parse("2026-08-15T10:00:00Z");
    const result = remainingUntil(target, now);
    expect(result).toEqual({
      days: 10,
      hours: 5,
      minutes: 29,
      seconds: 45,
      totalMs: target - now,
    });
  });

  it("6.5 clamps a past target to all zeros, never negative", () => {
    const now = Date.parse("2026-08-20T00:00:00Z");
    const target = Date.parse("2026-08-15T10:00:00Z");
    const result = remainingUntil(target, now);
    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
  });

  it("returns all zeros exactly at the target instant", () => {
    const target = Date.parse("2026-08-15T10:00:00Z");
    expect(remainingUntil(target, target).totalMs).toBe(0);
  });
});

describe("@phase6 isDepartureDay", () => {
  it("6.3 is timezone-correct across a UTC day boundary (Auckland, UTC+12 in August)", () => {
    // 11pm UTC Aug 15 is already 11am Aug 16 in Auckland.
    const nowUtcMs = Date.parse("2026-08-15T23:00:00Z");
    // 1am UTC Aug 16 is 1pm Aug 16 in Auckland — same Auckland calendar day.
    const startUtcMs = Date.parse("2026-08-16T01:00:00Z");
    expect(isDepartureDay(nowUtcMs, startUtcMs, "Pacific/Auckland")).toBe(true);
    // The same two instants are NOT the same UTC calendar day.
    expect(isDepartureDay(nowUtcMs, startUtcMs, "UTC")).toBe(false);
  });

  it("false the day before departure", () => {
    const startUtcMs = Date.parse("2026-08-16T09:00:00Z");
    const dayBefore = Date.parse("2026-08-15T09:00:00Z");
    expect(isDepartureDay(dayBefore, startUtcMs, "UTC")).toBe(false);
  });
});
