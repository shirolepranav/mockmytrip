// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./use-countdown";

describe("useCountdown (@phase6)", () => {
  const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes exact D/H/M/S for a 10d3h delta", () => {
    const target = NOW + 10 * 86_400_000 + 3 * 3_600_000;
    const { result } = renderHook(() => useCountdown(target, NOW, 1000));
    expect(result.current.days).toBe(10);
    expect(result.current.hours).toBe(3);
    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(0);
  });

  it("never returns a negative remainingMs even when the target is already past", () => {
    const target = NOW - 5000;
    const { result } = renderHook(() => useCountdown(target, NOW, 1000));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.days).toBe(0);
    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(0);
  });

  it("stays clamped at 0 as real time advances past the target", () => {
    const target = NOW + 2000;
    const { result } = renderHook(() => useCountdown(target, NOW, 1000));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.remainingMs).toBe(0);
  });

  it("ticks on the provided cadence (1s vs 60s)", () => {
    const target = NOW + 90_000;
    const fast = renderHook(() => useCountdown(target, NOW, 1000));
    const slow = renderHook(() => useCountdown(target, NOW, 60_000));

    // Let each hook's mount-time resync (a rAF-deferred setState) settle.
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const fastAfterMount = fast.result.current.remainingMs;
    const slowAfterMount = slow.result.current.remainingMs;

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(fast.result.current.remainingMs).toBeLessThan(fastAfterMount); // 1s interval fired
    expect(slow.result.current.remainingMs).toBe(slowAfterMount); // 60s interval hasn't fired yet

    act(() => {
      vi.advanceTimersByTime(58_500);
    });
    expect(slow.result.current.remainingMs).toBeLessThan(slowAfterMount); // 60s interval fired
  });
});
