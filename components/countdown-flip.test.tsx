// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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

/**
 * Reads the settled value of a countdown field. Under Motion's AnimatePresence,
 * an outgoing digit can still be mid-exit (and thus still in the DOM,
 * `aria-hidden`) alongside the incoming one — `[data-flap-current="true"]`
 * is how the component marks which char is actually the current one. In
 * reduced motion there's no such attribute at all (plain text, no overlap),
 * so this falls back to the field's whole text content.
 */
function fieldValue(fieldTestId: string): string {
  const field = screen.getByTestId(fieldTestId);
  const current = field.querySelectorAll('[data-flap-current="true"]');
  if (current.length > 0) {
    return Array.from(current)
      .map((el) => el.textContent)
      .join("");
  }
  return field.textContent ?? "";
}

describe("CountdownFlip (@phase6)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("6.3 renders the correct digit breakdown at a fixed instant", () => {
    mockMatchMedia(false);
    const now = Date.parse("2026-08-05T04:30:15Z");
    vi.setSystemTime(now);
    const target = Date.parse("2026-08-15T10:00:00Z"); // 10d 5h 29m 45s out

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    expect(fieldValue("countdown-field-days")).toBe("10");
    expect(fieldValue("countdown-field-hrs")).toBe("05");
    expect(fieldValue("countdown-field-min")).toBe("29");
    expect(fieldValue("countdown-field-sec")).toBe("45");
  });

  it("non-reduced motion ticks every second", () => {
    mockMatchMedia(false);
    const now = Date.parse("2026-08-05T04:30:15Z");
    vi.setSystemTime(now);
    const target = Date.parse("2026-08-15T10:00:00Z");

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fieldValue("countdown-field-sec")).toBe("44");
  });

  it("6.11 reduced motion ticks once a minute, not every second", () => {
    mockMatchMedia(true);
    const now = Date.parse("2026-08-05T04:30:15Z");
    vi.setSystemTime(now);
    const target = Date.parse("2026-08-15T10:00:00Z");

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // A single 1s tick alone shouldn't have moved the display under reduced motion.
    expect(fieldValue("countdown-field-sec")).toBe("45");
    expect(fieldValue("countdown-field-min")).toBe("29");

    act(() => {
      vi.advanceTimersByTime(59_000); // completes the first full 60s tick
    });
    // The minute field moved (proving the 60s tick fired); the seconds
    // field is unchanged, since an exact whole minute elapsed.
    expect(fieldValue("countdown-field-min")).toBe("28");
    expect(fieldValue("countdown-field-sec")).toBe("45");
  });

  it("6.4 day-rollover flourish + aria-live fire once when the days digit decrements, not every tick", () => {
    mockMatchMedia(false);
    const DAY_MS = 86_400_000;
    const target = Date.parse("2026-08-20T00:00:00Z");
    const now = target - 5 * DAY_MS - 2000; // 5 days + 2s remaining
    vi.setSystemTime(now);

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    const initialAnnounce = screen.getByTestId("countdown-aria-live").textContent;
    expect(initialAnnounce).toBe("5 days until departure");
    expect(fieldValue("countdown-field-days")).toBe("05");

    act(() => {
      vi.advanceTimersByTime(1000); // 1st tick: still 5 days remaining
    });
    expect(screen.queryByTestId("day-rollover-flourish")).toBeNull();
    expect(screen.getByTestId("countdown-aria-live").textContent).toBe(initialAnnounce);

    act(() => {
      vi.advanceTimersByTime(1000); // 2nd tick: exactly 5 days remaining
    });
    expect(screen.queryByTestId("day-rollover-flourish")).toBeNull();
    expect(screen.getByTestId("countdown-aria-live").textContent).toBe(initialAnnounce);

    act(() => {
      vi.advanceTimersByTime(1000); // 3rd tick: crosses below 5 days
    });
    expect(screen.getByTestId("day-rollover-flourish")).not.toBeNull();
    expect(screen.getByTestId("countdown-aria-live").textContent).toBe(
      "4 days until departure",
    );
    expect(fieldValue("countdown-field-days")).toBe("04");

    act(() => {
      vi.advanceTimersByTime(900); // flourish's own timeout elapses
    });
    expect(screen.queryByTestId("day-rollover-flourish")).toBeNull();
  });

  it("reduced motion never shows the day-rollover flourish", () => {
    mockMatchMedia(true);
    const DAY_MS = 86_400_000;
    const target = Date.parse("2026-08-20T00:00:00Z");
    const now = target - 5 * DAY_MS - 1000;
    vi.setSystemTime(now);

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(60_000); // well past the days boundary
    });
    expect(screen.queryByTestId("day-rollover-flourish")).toBeNull();
  });

  it("6.5 never renders a negative countdown for a past target", () => {
    mockMatchMedia(false);
    const now = Date.parse("2026-08-20T00:00:00Z");
    vi.setSystemTime(now);
    const target = Date.parse("2026-08-15T10:00:00Z"); // already past

    render(
      <MotionProvider>
        <CountdownFlip targetUtcMs={target} initialNowUtcMs={now} />
      </MotionProvider>,
    );

    expect(fieldValue("countdown-field-days")).toBe("00");
    expect(fieldValue("countdown-field-hrs")).toBe("00");
    expect(fieldValue("countdown-field-min")).toBe("00");
    expect(fieldValue("countdown-field-sec")).toBe("00");
  });
});
