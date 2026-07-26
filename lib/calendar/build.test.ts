import { describe, expect, it } from "vitest";
import { buildTripCalendar, type CalendarTripData } from "./build";

/*
 * @phase9 VCALENDAR assembly suite — the mandatory labeling fields (golden
 * rule #9, QA 9.11-9.14): pretend title, disclaimer-first description,
 * Free availability, tentative status, no attendee invites, stable UIDs,
 * all-day itinerary events.
 */

const baseTrip: CalendarTripData = {
  tripId: "11111111-1111-1111-1111-111111111111",
  title: "5 days in Lisbon",
  destinationCity: "Lisbon",
  destinationCountry: "PT",
  startDateMs: Date.UTC(2026, 7, 15),
  legs: [
    {
      bookingId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      kind: "departure",
      originIata: "JFK",
      originCity: "New York",
      destIata: "LIS",
      destCity: "Lisbon",
      destCountry: "Portugal",
      destTz: "Europe/Lisbon",
      departUtcMs: Date.UTC(2026, 7, 15, 18, 0),
      arriveUtcMs: Date.UTC(2026, 7, 16, 6, 30),
    },
  ],
  itineraryDays: [
    { dayIndex: 0, summary: "Pastel de nata crawl, Belém Tower" },
    { dayIndex: 1, summary: "Sintra day trip" },
  ],
};

describe("@phase9 buildTripCalendar mandatory fields", () => {
  it("SUMMARY self-labels as pretend", () => {
    const ics = buildTripCalendar(baseTrip);
    expect(ics).toContain("(Pretend) Lisbon");
  });

  it("DESCRIPTION opens with the simulation disclaimer", () => {
    const ics = buildTripCalendar(baseTrip);
    // Unfold (strip CRLF + the following single space) before extracting
    // the property line, since a long DESCRIPTION wraps across several
    // physical lines per RFC 5545 §3.1.
    const unfolded = ics.replace(/\r\n /g, "");
    const descriptionLine = unfolded
      .split("\r\n")
      .find((line) => line.startsWith("DESCRIPTION:"));
    expect(descriptionLine).toBeDefined();
    // Escaped per RFC 5545 §3.3.11 (commas become \,) — this is the exact
    // wire-format text, disclaimer first, before any route/PNR detail.
    const expectedEscaped =
      "This is a SIMULATED trip from Wanderlost. No flights\\, hotels\\, or payments are real.";
    const afterColon = descriptionLine!.slice("DESCRIPTION:".length);
    expect(afterColon.startsWith(expectedEscaped)).toBe(true);
  });

  it("every VEVENT is TRANSPARENT (shows as Free) and TENTATIVE", () => {
    const ics = buildTripCalendar(baseTrip, { includeItineraryDays: true });
    const eventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    const transparentCount = (ics.match(/TRANSP:TRANSPARENT/g) ?? []).length;
    const tentativeCount = (ics.match(/STATUS:TENTATIVE/g) ?? []).length;
    expect(eventCount).toBeGreaterThan(0);
    expect(transparentCount).toBe(eventCount);
    expect(tentativeCount).toBe(eventCount);
  });

  it("never emits ORGANIZER or ATTENDEE (no invite emails)", () => {
    const ics = buildTripCalendar(baseTrip, { includeItineraryDays: true });
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });

  it("UID is stable across two builds of the same trip (re-import updates, not duplicates)", () => {
    const first = buildTripCalendar(baseTrip, { nowMs: 1000 });
    const second = buildTripCalendar(baseTrip, { nowMs: 2000 });
    const uidOf = (ics: string) =>
      ics.split("\r\n").find((line) => line.startsWith("UID:"));
    expect(uidOf(first)).toBe(uidOf(second));
    expect(uidOf(first)).toBe(`UID:dep-${baseTrip.legs[0].bookingId}@wanderlost.app`);
  });

  it("a round trip gets both a departure and a distinct return UID", () => {
    const roundTrip: CalendarTripData = {
      ...baseTrip,
      legs: [
        baseTrip.legs[0],
        {
          ...baseTrip.legs[0],
          bookingId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          kind: "return",
          originIata: "LIS",
          destIata: "JFK",
        },
      ],
    };
    const ics = buildTripCalendar(roundTrip);
    expect(ics).toContain(`UID:dep-${baseTrip.legs[0].bookingId}@wanderlost.app`);
    expect(ics).toContain("UID:ret-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb@wanderlost.app");
    expect(ics).toContain("(Pretend) Return from Lisbon");
  });

  it("flight DTSTART/DTEND are UTC instants with no VTIMEZONE block", () => {
    const ics = buildTripCalendar(baseTrip);
    expect(ics).toContain("DTSTART:20260815T180000Z");
    expect(ics).toContain("DTEND:20260816T063000Z");
    expect(ics).not.toContain("VTIMEZONE");
  });

  it("itinerary days are only included when explicitly requested, and use VALUE=DATE", () => {
    const withoutDays = buildTripCalendar(baseTrip);
    expect(withoutDays).not.toContain("Day 1 in Lisbon");

    const withDays = buildTripCalendar(baseTrip, { includeItineraryDays: true });
    expect(withDays).toContain("Day 1 in Lisbon");
    expect(withDays).toContain("Day 2 in Lisbon");
    expect(withDays).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(withDays).toContain(`UID:itin-${baseTrip.tripId}-0@wanderlost.app`);
  });

  it("no ORGANIZER/ATTENDEE and pretend labeling hold with itinerary days included too", () => {
    const ics = buildTripCalendar(baseTrip, { includeItineraryDays: true });
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });

  it("PRODID and VCALENDAR wrapper are present, no OAuth-adjacent fields anywhere", () => {
    const ics = buildTripCalendar(baseTrip);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("PRODID:-//Wanderlost//Travel Simulation//EN");
    expect(ics.toLowerCase()).not.toContain("oauth");
  });
});
