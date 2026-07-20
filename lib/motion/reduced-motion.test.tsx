// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MotionProvider, useMotionPrefs } from "./reduced-motion";

function Probe() {
  const { reduced, override, setOverride } = useMotionPrefs();
  return (
    <div>
      <span data-testid="reduced">{String(reduced)}</span>
      <span data-testid="override">{override}</span>
      <button type="button" onClick={() => setOverride("reduced")}>
        force-reduced
      </button>
      <button type="button" onClick={() => setOverride("full")}>
        force-full
      </button>
    </div>
  );
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("MotionProvider (@phase0)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reports reduced=false when the OS has no preference", () => {
    mockMatchMedia(false);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId("reduced").textContent).toBe("false");
  });

  it("reports reduced=true when prefers-reduced-motion is set", () => {
    mockMatchMedia(true);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId("reduced").textContent).toBe("true");
  });

  it("user override wins over the OS in both directions", () => {
    mockMatchMedia(false);
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    act(() => screen.getByText("force-reduced").click());
    expect(screen.getByTestId("reduced").textContent).toBe("true");
    expect(window.localStorage.getItem("wanderlost.motion-override")).toBe(
      "reduced",
    );

    act(() => screen.getByText("force-full").click());
    expect(screen.getByTestId("reduced").textContent).toBe("false");
  });

  it("restores a persisted override on mount", () => {
    mockMatchMedia(false);
    window.localStorage.setItem("wanderlost.motion-override", "reduced");
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByTestId("reduced").textContent).toBe("true");
    expect(screen.getByTestId("override").textContent).toBe("reduced");
  });
});
