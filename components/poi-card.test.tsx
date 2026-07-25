// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoiCard } from "./poi-card";
import type { PoiWithDistance } from "@/lib/services/pois";

/*
 * @phase7 PoiCard: the "Real place" chip and attribution line always
 * render, and the DOM never carries a fake price/rating string (QA 7.12's
 * DOM-scan philosophy, applied at the component level).
 */

function makePoi(overrides: Partial<PoiWithDistance> = {}): PoiWithDistance {
  return {
    id: "poi-1",
    name: "Belém Tower",
    city: "Lisbon",
    isoCountry: "PT",
    lat: 38.6916,
    lng: -9.216,
    category: "landmark",
    description: "A 16th-century fortified tower on the Tagus estuary.",
    imageUrl: null,
    source: "wikidata",
    sourceId: "Q1234",
    attribution: "Wikidata (CC0)",
    rank: 100,
    distanceFromCenterKm: 6.2,
    ...overrides,
  };
}

const FAKE_DATA_PATTERN = /\$\d|★|rating|review|per night|price/i;

describe("PoiCard (@phase7)", () => {
  it("7.12 always shows the Real place chip and attribution", () => {
    render(<PoiCard poi={makePoi()} />);
    expect(screen.getByTestId("poi-real-place-chip")).toHaveTextContent("Real place");
    expect(screen.getByTestId("poi-attribution")).toHaveTextContent("Wikidata (CC0)");
  });

  it("never renders a fake price or rating, with or without a description", () => {
    const { container, rerender } = render(<PoiCard poi={makePoi()} />);
    expect(container.textContent).not.toMatch(FAKE_DATA_PATTERN);

    rerender(<PoiCard poi={makePoi({ description: null, distanceFromCenterKm: null })} />);
    expect(container.textContent).not.toMatch(FAKE_DATA_PATTERN);
  });

  it("shows the add-to-itinerary button only when the callback is provided", () => {
    const { rerender } = render(<PoiCard poi={makePoi()} />);
    expect(screen.queryByTestId("poi-add-to-itinerary")).toBeNull();

    const onAdd = vi.fn();
    rerender(<PoiCard poi={makePoi()} onAddToItinerary={onAdd} />);
    screen.getByTestId("poi-add-to-itinerary").click();
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "poi-1" }));
  });
});
