import { utcToZonedParts } from "@/lib/engine/timezone";
import { escapeIcsText, foldLine, formatDateOnly, formatUtcStamp } from "./format";

/*
 * VCALENDAR assembly (TECH_SPEC §8b.3, golden rule #9). Hand-rolled rather
 * than the `ics` npm package — precise control over the mandatory labeling
 * fields, no new dependency. Deliberately UTC-only (no VTIMEZONE block):
 * flights.departAt/arriveAt are already-correct UTC instants, and every
 * calendar client converts a UTC instant to local display correctly by
 * definition, so a VTIMEZONE block (which would need a maintained
 * IANA-tzdata-to-RRULE library to get DST transitions right) adds real
 * fragility for zero correctness gain here.
 */

export interface CalendarFlightLeg {
  bookingId: string;
  kind: "departure" | "return";
  originIata: string;
  originCity: string;
  destIata: string;
  destCity: string;
  destCountry: string;
  destTz: string;
  departUtcMs: number;
  arriveUtcMs: number;
}

export interface CalendarItineraryDayEvent {
  dayIndex: number;
  /** Comma-joined titles of that day's itinerary items. */
  summary: string;
}

export interface CalendarTripData {
  tripId: string;
  title: string;
  destinationCity: string;
  destinationCountry: string | null;
  startDateMs: number;
  legs: CalendarFlightLeg[];
  itineraryDays: CalendarItineraryDayEvent[];
}

export interface BuildCalendarOptions {
  includeItineraryDays?: boolean;
  /** Injectable for deterministic tests; defaults to the real clock. */
  nowMs?: number;
}

const DAY_MS = 86_400_000;
const DISCLAIMER =
  "This is a SIMULATED trip from Wanderlost. No flights, hotels, or payments are real.";

function textLine(key: string, value: string): string {
  return foldLine(`${key}:${escapeIcsText(value)}`);
}

/** For non-TEXT value types (dates, UIDs) that must not be escaped. */
function rawLine(key: string, value: string): string {
  return foldLine(`${key}:${value}`);
}

function flightSummary(leg: CalendarFlightLeg, city: string): string {
  return leg.kind === "departure"
    ? `✈ (Pretend) ${city} · Wanderlost`
    : `✈ (Pretend) Return from ${city} · Wanderlost`;
}

function buildFlightEvent(leg: CalendarFlightLeg, city: string, nowMs: number): string[] {
  const description = [
    DISCLAIMER,
    "",
    `${leg.originCity} (${leg.originIata}) → ${leg.destCity} (${leg.destIata})`,
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    rawLine("UID", `${leg.kind === "departure" ? "dep" : "ret"}-${leg.bookingId}@wanderlost.app`),
    rawLine("DTSTAMP", formatUtcStamp(nowMs)),
    rawLine("DTSTART", formatUtcStamp(leg.departUtcMs)),
    rawLine("DTEND", formatUtcStamp(leg.arriveUtcMs)),
    textLine("SUMMARY", flightSummary(leg, city)),
    textLine("DESCRIPTION", description),
    textLine("LOCATION", `${leg.destCity}, ${leg.destCountry}`),
    "TRANSP:TRANSPARENT",
    "STATUS:TENTATIVE",
    "END:VEVENT",
  ];
}

function buildItineraryDayEvent(
  day: CalendarItineraryDayEvent,
  trip: CalendarTripData,
  tz: string,
  nowMs: number,
): string[] {
  const dayStartMs = trip.startDateMs + day.dayIndex * DAY_MS;
  const start = utcToZonedParts(dayStartMs, tz);
  const end = utcToZonedParts(dayStartMs + DAY_MS, tz);
  const location = trip.destinationCountry
    ? `${trip.destinationCity}, ${trip.destinationCountry}`
    : trip.destinationCity;

  return [
    "BEGIN:VEVENT",
    rawLine("UID", `itin-${trip.tripId}-${day.dayIndex}@wanderlost.app`),
    rawLine("DTSTAMP", formatUtcStamp(nowMs)),
    rawLine("DTSTART;VALUE=DATE", formatDateOnly(start.year, start.month, start.day)),
    rawLine("DTEND;VALUE=DATE", formatDateOnly(end.year, end.month, end.day)),
    textLine(
      "SUMMARY",
      `✈ (Pretend) Day ${day.dayIndex + 1} in ${trip.destinationCity} · Wanderlost`,
    ),
    textLine("DESCRIPTION", [DISCLAIMER, "", day.summary].join("\n")),
    textLine("LOCATION", location),
    "TRANSP:TRANSPARENT",
    "STATUS:TENTATIVE",
    "END:VEVENT",
  ];
}

/**
 * Assemble the full VCALENDAR text. No ORGANIZER/ATTENDEE lines are ever
 * emitted (no invite emails). Every VEVENT self-labels as pretend, is
 * TRANSPARENT (shows as Free) and TENTATIVE, and carries a stable UID so a
 * re-download updates the existing calendar entry rather than duplicating
 * it (QA 9.13).
 */
export function buildTripCalendar(
  trip: CalendarTripData,
  options: BuildCalendarOptions = {},
): string {
  const nowMs = options.nowMs ?? Date.now();
  const destTz = trip.legs[0]?.destTz ?? "UTC";

  const events: string[] = [];
  for (const leg of trip.legs) {
    events.push(...buildFlightEvent(leg, trip.destinationCity, nowMs));
  }
  if (options.includeItineraryDays) {
    for (const day of trip.itineraryDays) {
      events.push(...buildItineraryDayEvent(day, trip, destTz, nowMs));
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    rawLine("PRODID", "-//Wanderlost//Travel Simulation//EN"),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
