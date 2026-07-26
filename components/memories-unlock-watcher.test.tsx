// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoriesUnlockWatcher } from "./memories-unlock-watcher";

/*
 * @phase8 MemoriesUnlockWatcher (QA 8.8's in-session unlock): schedules
 * exactly one router.refresh() at the trip's end-date boundary, and
 * refreshes immediately if that boundary has already passed by mount time.
 */

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

describe("@phase8 MemoriesUnlockWatcher", () => {
  it("refreshes immediately if the end date has already passed", () => {
    refreshMock.mockReset();
    const now = 10_000;
    render(<MemoriesUnlockWatcher endDateMs={now - 1000} initialNowMs={now} />);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("schedules a single refresh at the exact remaining delay, not before", () => {
    refreshMock.mockReset();
    vi.useFakeTimers();
    const now = 10_000;
    render(<MemoriesUnlockWatcher endDateMs={now + 5000} initialNowMs={now} />);

    expect(refreshMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4999);
    expect(refreshMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("clears its timer on unmount (no refresh fires after)", () => {
    refreshMock.mockReset();
    vi.useFakeTimers();
    const now = 10_000;
    const { unmount } = render(
      <MemoriesUnlockWatcher endDateMs={now + 5000} initialNowMs={now} />,
    );
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(refreshMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
