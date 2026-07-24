import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb, schema } from "@/lib/db/client";
import { byIata } from "@/lib/engine/airports";
import { assertOwner, OwnershipError } from "@/lib/services/ownership";

/*
 * Single source of truth for boarding-pass content, consumed by the
 * on-screen component, the PDF renderer, and the confirmation email —
 * three separate renderers, one shared data shape (DS §9's "shared layout
 * tokens" — the tokens are the data + lib/design/colors.ts, not literal
 * shared JSX, since react-pdf/React Email can't render DOM components).
 */

export interface BoardingPassData {
  bookingId: string;
  tripId: string;
  pnr: string;
  seat: string | null;
  gate: string | null;
  cabin: string;
  airlineName: string;
  airlineCode: string;
  airlineHue: number;
  airlineLogoSeed: number;
  flightNumber: string;
  originIata: string;
  originCity: string;
  originCountry: string;
  originTz: string;
  destIata: string;
  destCity: string;
  destCountry: string;
  destTz: string;
  departUtcMs: number;
  arriveUtcMs: number;
  durationMin: number;
  /** PNG data URI encoding "SIMULATION|{pnr}". */
  qrDataUrl: string;
}

/**
 * Look up a boarding pass by booking id, enforcing ownership and that the
 * booking is a flight (hotel bookings have no pass). Every failure mode
 * collapses to the same generic OwnershipError — no info leak on a forged
 * bookingId (QA 5.9).
 */
export async function getBoardingPassData(
  userId: string,
  bookingId: string,
): Promise<BoardingPassData> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);
  const booking = rows[0];
  assertOwner(userId, booking);
  if (booking.type !== "flight" || !booking.flightId) throw new OwnershipError();

  const flightRows = await db
    .select()
    .from(schema.flights)
    .where(eq(schema.flights.id, booking.flightId))
    .limit(1);
  const flight = flightRows[0];
  if (!flight) throw new OwnershipError();

  const origin = byIata(flight.originIata);
  const destination = byIata(flight.destIata);
  if (!origin || !destination) throw new OwnershipError();

  const qrDataUrl = await QRCode.toDataURL(`SIMULATION|${booking.pnr}`);

  return {
    bookingId: booking.id,
    tripId: booking.tripId,
    pnr: booking.pnr,
    seat: booking.seat,
    gate: booking.gate,
    cabin: flight.cabin,
    airlineName: flight.airlineName,
    airlineCode: flight.airlineCode,
    airlineHue: flight.airlineHue,
    airlineLogoSeed: flight.airlineLogoSeed,
    flightNumber: flight.flightNumber,
    originIata: flight.originIata,
    originCity: origin.city,
    originCountry: origin.country,
    originTz: origin.tz,
    destIata: flight.destIata,
    destCity: destination.city,
    destCountry: destination.country,
    destTz: destination.tz,
    departUtcMs: flight.departAt.getTime(),
    arriveUtcMs: flight.arriveAt.getTime(),
    durationMin: flight.durationMin,
    qrDataUrl,
  };
}
