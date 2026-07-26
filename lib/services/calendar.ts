import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { byIata } from "@/lib/engine/airports";
import type { CalendarFlightLeg, CalendarItineraryDayEvent, CalendarTripData } from "@/lib/calendar/build";

/*
 * Calendar export data gathering (Phase 9 task 8). Auth is resolved by the
 * caller (app/api/calendar/[tripId]/route.ts, via assertCanView or a
 * ?token= share) — this function trusts that the tripId it's given has
 * already been authorized and just reads.
 */

/** Every trip has >=1 flight booking — createBooking throws EmptyDraftError
 * otherwise — so `legs` is never empty for a real trip id. */
export async function getCalendarTripData(tripId: string): Promise<CalendarTripData | null> {
  const db = await getDb();
  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.id, tripId))
    .limit(1);
  if (!trip) return null;

  const bookingRows = await db
    .select({ booking: schema.bookings, flight: schema.flights })
    .from(schema.bookings)
    .innerJoin(schema.flights, eq(schema.bookings.flightId, schema.flights.id))
    .where(and(eq(schema.bookings.tripId, tripId), eq(schema.bookings.type, "flight")))
    .orderBy(asc(schema.flights.departAt));

  const legs: CalendarFlightLeg[] = bookingRows.map((row, index) => {
    const origin = byIata(row.flight.originIata);
    const dest = byIata(row.flight.destIata);
    return {
      bookingId: row.booking.id,
      kind: index === 0 ? "departure" : "return",
      originIata: row.flight.originIata,
      originCity: origin?.city ?? row.flight.originIata,
      destIata: row.flight.destIata,
      destCity: dest?.city ?? row.flight.destIata,
      destCountry: dest?.country ?? "",
      destTz: dest?.tz ?? "UTC",
      departUtcMs: row.flight.departAt.getTime(),
      arriveUtcMs: row.flight.arriveAt.getTime(),
    };
  });

  const itemRows = await db
    .select({
      dayIndex: schema.itineraryItems.dayIndex,
      title: schema.itineraryItems.title,
    })
    .from(schema.itineraryItems)
    .where(eq(schema.itineraryItems.tripId, tripId))
    .orderBy(asc(schema.itineraryItems.dayIndex), asc(schema.itineraryItems.sortOrder));

  const titlesByDay = new Map<number, string[]>();
  for (const item of itemRows) {
    const list = titlesByDay.get(item.dayIndex) ?? [];
    list.push(item.title);
    titlesByDay.set(item.dayIndex, list);
  }
  const itineraryDays: CalendarItineraryDayEvent[] = [...titlesByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, titles]) => ({ dayIndex, summary: titles.join(", ") }));

  return {
    tripId: trip.id,
    title: trip.title,
    destinationCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    startDateMs: trip.startDate.getTime(),
    legs,
    itineraryDays,
  };
}
