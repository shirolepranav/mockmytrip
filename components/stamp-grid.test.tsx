// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MotionProvider } from "@/lib/motion/reduced-motion";
import { StampGrid } from "./stamp-grid";
import type { StampCardData } from "./stamp-card";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const STAMPS: StampCardData[] = [
  {
    id: "s1",
    city: "Lisbon",
    countryIso: "PT",
    stampStyle: 1,
    rotationDeg: -6,
    inkHue: 210,
    dateLabel: "Jul 1",
    distanceKm: 5400,
    tripId: "t1",
  },
  {
    id: "s2",
    city: "Tokyo",
    countryIso: "JP",
    stampStyle: 2,
    rotationDeg: 8,
    inkHue: 12,
    dateLabel: "Aug 3",
    distanceKm: 10800,
    tripId: "t2",
  },
];

describe("StampGrid (@phase6)", () => {
  it("renders every stamp with correct count and props (structural only — no GSAP internals asserted)", () => {
    mockMatchMedia(false);
    render(
      <MotionProvider>
        <StampGrid stamps={STAMPS} onSelect={() => {}} />
      </MotionProvider>,
    );
    const cards = screen.getAllByTestId("stamp-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("calls onSelect with the tapped stamp", () => {
    mockMatchMedia(false);
    const onSelect = vi.fn();
    render(
      <MotionProvider>
        <StampGrid stamps={STAMPS} onSelect={onSelect} />
      </MotionProvider>,
    );
    screen.getAllByTestId("stamp-card")[0].click();
    expect(onSelect).toHaveBeenCalledWith(STAMPS[0]);
  });

  it("renders the entrance-stamp card as a stamp-card too (structural equivalence, not animation)", () => {
    mockMatchMedia(false);
    render(
      <MotionProvider>
        <StampGrid stamps={STAMPS} entranceStampId="s1" onSelect={() => {}} />
      </MotionProvider>,
    );
    expect(screen.getAllByTestId("stamp-card")).toHaveLength(2);
  });

  it("reduced motion still renders every stamp (no entrance branch)", () => {
    mockMatchMedia(true);
    render(
      <MotionProvider>
        <StampGrid stamps={STAMPS} entranceStampId="s1" onSelect={() => {}} />
      </MotionProvider>,
    );
    expect(screen.getAllByTestId("stamp-card")).toHaveLength(2);
  });

  it("renders nothing when there are no stamps", () => {
    mockMatchMedia(false);
    render(
      <MotionProvider>
        <StampGrid stamps={[]} onSelect={() => {}} />
      </MotionProvider>,
    );
    expect(screen.queryAllByTestId("stamp-card")).toHaveLength(0);
  });
});
