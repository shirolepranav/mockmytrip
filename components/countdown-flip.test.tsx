// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "@/lib/motion/reduced-motion";
import { CountdownFlip } from "./countdown-flip";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const ORIGIN_TZ = "America/New_York";
const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

function renderCountdown(overrides: Partial<Parameters<typeof CountdownFlip>[0]> = {}) {
  const targetUtcMs = overrides.targetUtcMs ?? NOW + 10 * 86_400_000 + 3 * 3_600_000;
  return render(
    <MotionProvider>
      <CountdownFlip
        targetUtcMs={targetUtcMs}
        endUtcMs={targetUtcMs + 5 * 86_400_000}
        originTz={ORIGIN_TZ}
        destinationCity="Lisbon"
        nowUtcMs={NOW}
        {...overrides}
      />
    </MotionProvider>,
  );
}

describe("CountdownFlip (@phase6)", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the correct initial digits for a 10d3h delta", () => {
    renderCountdown();
    expect(screen.getByTestId("countdown-flap-days").textContent).toContain("10");
    expect(screen.getByTestId("countdown-flap-hours").textContent).toContain("03");
    expect(screen.getByTestId("countdown-flap-minutes").textContent).toContain("00");
    expect(screen.getByTestId("countdown-flap-seconds").textContent).toContain("00");
  });

  it("plays the day-rollover flourish exactly once when crossing midnight, and the aria-live day text changes only then", () => {
    const targetUtcMs = NOW + 2 * 86_400_000 + 12 * 3_600_000; // 2.5 days out
    renderCountdown({ targetUtcMs });

    const liveRegion = () => screen.getByText(/day.*to go/i);
    const before = liveRegion().textContent;

    // Advance 30s — no day change, aria-live text must stay identical.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(liveRegion().textContent).toBe(before);
    expect(screen.queryByTestId("countdown-day-rollover")).toBeNull();

    // Advance across the day boundary.
    act(() => {
      vi.advanceTimersByTime(86_400_000);
    });
    expect(liveRegion().textContent).not.toBe(before);
    expect(screen.getByTestId("countdown-day-rollover")).toBeInTheDocument();

    // Flourish clears itself after its window.
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.queryByTestId("countdown-day-rollover")).toBeNull();
  });

  it("reduced motion ticks once a minute, not once a second", () => {
    mockMatchMedia(true);
    const targetUtcMs = NOW + 90_000; // 1m30s out
    renderCountdown({ targetUtcMs });

    const minutesBefore = screen.getByTestId("countdown-flap-minutes").textContent;
    expect(minutesBefore).toContain("01");

    // Mid-minute: no tick has fired yet, nothing should change.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("countdown-flap-minutes").textContent).toBe(minutesBefore);

    // A full 60s tick fires — the minute digit updates (01 -> 00).
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("countdown-flap-minutes").textContent).not.toBe(minutesBefore);
  });

  it("switches to the Bon voyage phase and never renders a negative countdown once departed", () => {
    const targetUtcMs = NOW - 5000; // already departed
    renderCountdown({ targetUtcMs, endUtcMs: NOW + 4 * 86_400_000 });
    expect(screen.getByTestId("countdown-bon-voyage")).toBeInTheDocument();
    expect(screen.queryByTestId("countdown-flip")).toBeNull();
    expect(screen.queryByText(/-\d/)).toBeNull();
  });

  it("shows the departure-day copy when now and target share the same local day", () => {
    const targetUtcMs = NOW - 1000; // departed moments ago, same local day
    renderCountdown({ targetUtcMs, endUtcMs: NOW + 4 * 86_400_000 });
    expect(screen.getByText(/off to Lisbon/i)).toBeInTheDocument();
  });
});
