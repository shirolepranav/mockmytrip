import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, getBookingDb, schema } from "@/lib/db/client";
import { flightOfferViewSchema, type FlightOfferView } from "@/lib/offer-view";
import { hotelOfferViewSchema, type HotelOfferView } from "@/lib/hotel-offer-view";
import { generateTripTitle } from "@/lib/trip-summary";
import { hashSeed, seededRandom, randInt, pick } from "@/lib/engine/seed";
import { statusOf, type TripDraft } from "./trips";
import { getBoardingPassData } from "@/lib/boarding-pass-view";
import { renderBoardingPassPdf } from "@/lib/pdf/boarding-pass-pdf";

/*
 * Booking creation (Phase 5 — the emotional peak): turns a trip draft into
 * real trip/flights/bookings/passport_stamps rows in one all-or-nothing
 * transaction, then (outside the transaction) sends the PDF + email.
 * Idempotent by design — double-tapping "Confirm" never creates a second
 * booking (QA 5.4).
 */

export class EmptyDraftError extends Error {
  constructor() {
    super("No flight in your trip draft yet");
    this.name = "EmptyDraftError";
  }
}

export interface CreateBookingResult {
  tripId: string;
  bookingId: string;
  pnr: string;
  emailStatus: "sent" | "skipped" | "failed";
}

/* ── Fictional PNR / seat / gate (one-time real writes — plain randomness,
   not seeded like the search engine's reproducible offers). ────────────── */

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const GATE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function randomChars(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generatePnr(): string {
  return `SIM-${randomChars(PNR_CHARS, 6)}`;
}

export function generateSeat(): string {
  return `${randInt(Math.random, 2, 42)}${pick(Math.random, SEAT_LETTERS)}`;
}

export function generateGate(): string {
  return `${pick(Math.random, GATE_LETTERS)}${randInt(Math.random, 1, 40)}`;
}

/* ── Idempotency key: one hash per (user, flight, return, hotel) combo. ─── */

function computeGroupKey(
  userId: string,
  flight: FlightOfferView,
  returnFlight: FlightOfferView | null,
  hotel: HotelOfferView | null,
): string {
  return createHash("sha256")
    .update(`${userId}:${flight.id}:${returnFlight?.id ?? ""}:${hotel?.id ?? ""}`)
    .digest("hex");
}

async function findByIdempotencyKey(groupKey: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.bookings.id, tripId: schema.bookings.tripId, pnr: schema.bookings.pnr })
    .from(schema.bookings)
    .where(eq(schema.bookings.idempotencyKey, groupKey))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Postgres unique-violation (23505) detection. Drivers/ORMs sometimes wrap
 * the underlying pg error in an outer Error (e.g. a query-failed wrapper
 * with the real error as `.cause`), so this checks both the error itself
 * and one level of `.cause`.
 */
function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value
      ? (value as { code?: unknown }).code
      : undefined;
  if (codeOf(error) === "23505") return true;
  const cause = error instanceof Error ? error.cause : undefined;
  return codeOf(cause) === "23505";
}

/** Parse the draft the same way lib/trip-summary.ts does. */
function parseDraft(draft: TripDraft | null | undefined) {
  const flightResult = flightOfferViewSchema.safeParse(draft?.flight);
  if (!flightResult.success) throw new EmptyDraftError();
  const returnResult = flightOfferViewSchema.safeParse(draft?.returnFlight);
  const hotelResult = hotelOfferViewSchema.safeParse(draft?.hotel);
  const rawTitle = draft?.title;
  return {
    flight: flightResult.data,
    returnFlight: returnResult.success ? returnResult.data : null,
    hotel: hotelResult.success ? hotelResult.data : null,
    title:
      typeof rawTitle === "string" && rawTitle.trim().length > 0
        ? rawTitle.trim()
        : null,
  };
}

const DAY_MS = 86_400_000;

async function runBookingTransaction(
  userId: string,
  flight: FlightOfferView,
  returnFlight: FlightOfferView | null,
  hotel: HotelOfferView | null,
  title: string | null,
  groupKey: string,
): Promise<{ tripId: string; bookingId: string; pnr: string }> {
  const bookingDb = await getBookingDb();

  return bookingDb.transaction(async (tx) => {
    // Closures over `tx` (rather than standalone functions taking `tx` as a
    // typed parameter) so TypeScript can infer the transaction type from
    // this single call site — it differs structurally between the
    // neon-serverless and pglite drivers, which BookingDb unions together.
    async function insertFlightLeg(
      offer: FlightOfferView,
      idempotencyKey: string | null,
    ): Promise<{ bookingId: string; pnr: string }> {
      const [flightRow] = await tx
        .insert(schema.flights)
        .values({
          airlineName: offer.airlineName,
          airlineCode: offer.airlineCode,
          airlineHue: offer.airlineHue,
          airlineLogoSeed: offer.airlineLogoSeed,
          flightNumber: offer.flightNumber,
          originIata: offer.originIata,
          destIata: offer.destIata,
          departAt: new Date(offer.departUtcMs),
          arriveAt: new Date(offer.arriveUtcMs),
          durationMin: offer.durationMin,
          distanceKm: offer.distanceKm,
          cabin: offer.cabin,
          stops: offer.stops,
          priceCents: offer.priceCents,
          seed: offer.seed,
        })
        .returning();

      const pnr = generatePnr();
      const [bookingRow] = await tx
        .insert(schema.bookings)
        .values({
          tripId: trip.id,
          userId,
          type: "flight",
          flightId: flightRow.id,
          pnr,
          seat: generateSeat(),
          gate: generateGate(),
          priceCents: offer.priceCents,
          savedCents: offer.savedCents,
          idempotencyKey,
        })
        .returning();

      return { bookingId: bookingRow.id, pnr };
    }

    async function insertHotelBooking(offer: HotelOfferView): Promise<void> {
      const [hotelRow] = await tx
        .insert(schema.hotels)
        .values({
          name: offer.name,
          brand: null,
          city: offer.city,
          isoCountry: offer.country,
          lat: null,
          lng: null,
          starRating: offer.stars,
          heroSeed: offer.heroSeed,
          amenitiesJson: offer.amenities,
          nightlyBaseCents: offer.nightlyCents,
        })
        .returning();

      await tx.insert(schema.bookings).values({
        tripId: trip.id,
        userId,
        type: "hotel",
        hotelId: hotelRow.id,
        pnr: generatePnr(),
        seat: null,
        gate: null,
        priceCents: offer.totalCents,
        savedCents: offer.savedCents,
        idempotencyKey: null,
      });
    }

    const now = new Date();
    const startDate = new Date(flight.departUtcMs);
    const endDate = returnFlight
      ? new Date(returnFlight.arriveUtcMs)
      : hotel
        ? new Date(flight.arriveUtcMs + hotel.nights * DAY_MS)
        : new Date(flight.arriveUtcMs);

    const [trip] = await tx
      .insert(schema.trips)
      .values({
        userId,
        title: title ?? generateTripTitle(flight.destCity, hotel?.nights ?? 0),
        destinationCity: flight.destCity,
        destinationCountry: flight.destCountry,
        coverSeed: hashSeed(`cover:${flight.destCity}:${startDate.toISOString()}`),
        startDate,
        endDate,
        status: statusOf({ startDate, endDate }, now),
      })
      .returning();

    const outbound = await insertFlightLeg(flight, groupKey);
    if (returnFlight) {
      await insertFlightLeg(returnFlight, null);
    }
    if (hotel) {
      await insertHotelBooking(hotel);
    }

    // Passport stamp: cosmetic values seeded off the new trip id for a
    // consistent look; distanceKm feeds Phase 6's "miles dreamed" tally.
    const stampRand = seededRandom(hashSeed(`stamp:${trip.id}`));
    const distanceKm = flight.distanceKm + (returnFlight?.distanceKm ?? 0);
    await tx.insert(schema.passportStamps).values({
      userId,
      tripId: trip.id,
      countryIso: flight.destCountry,
      city: flight.destCity,
      stampStyle: randInt(stampRand, 0, 5),
      stampDate: now,
      rotationDeg: randInt(stampRand, -18, 18),
      inkHue: randInt(stampRand, 0, 359),
      distanceKm,
    });

    const totalSaved =
      flight.savedCents + (returnFlight?.savedCents ?? 0) + (hotel?.savedCents ?? 0);
    await tx
      .update(schema.users)
      .set({ totalSavedCents: sql`${schema.users.totalSavedCents} + ${totalSaved}` })
      .where(eq(schema.users.id, userId));

    await tx.delete(schema.tripDrafts).where(eq(schema.tripDrafts.userId, userId));

    return { tripId: trip.id, bookingId: outbound.bookingId, pnr: outbound.pnr };
  });
}

export async function createBooking(
  userId: string,
  draft: TripDraft | null | undefined,
  email?: string,
): Promise<CreateBookingResult> {
  const { flight, returnFlight, hotel, title } = parseDraft(draft);
  const groupKey = computeGroupKey(userId, flight, returnFlight, hotel);

  const existing = await findByIdempotencyKey(groupKey);
  let result: { tripId: string; bookingId: string; pnr: string };
  if (existing) {
    result = { tripId: existing.tripId, bookingId: existing.id, pnr: existing.pnr };
  } else {
    try {
      result = await runBookingTransaction(
        userId,
        flight,
        returnFlight,
        hotel,
        title,
        groupKey,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Race backstop: a concurrent double-tap beat us to the insert.
      const raced = await findByIdempotencyKey(groupKey);
      if (!raced) throw error;
      result = { tripId: raced.tripId, bookingId: raced.id, pnr: raced.pnr };
    }
  }

  let emailStatus: CreateBookingResult["emailStatus"] = "skipped";
  if (email) {
    emailStatus = await dispatchConfirmationEmail(userId, result.bookingId, email);
  }

  return { ...result, emailStatus };
}

/*
 * Post-commit email dispatch: never throws, never blocks a booking from
 * succeeding (QA 5.8, WF §11 — the pass is always viewable even if this
 * fails). Mirrors lib/services/auth.ts's sendMagicLinkEmail resilience
 * pattern, with an HTML React Email template + PDF attachment instead of
 * plain text.
 */
async function dispatchConfirmationEmail(
  userId: string,
  bookingId: string,
  email: string,
): Promise<"sent" | "failed"> {
  try {
    const data = await getBoardingPassData(userId, bookingId);
    const pdfBuffer = await renderBoardingPassPdf(data);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(
        `[wanderlost] booking confirmation for ${email}: PNR ${data.pnr} (no RESEND_API_KEY set)`,
      );
      return "failed";
    }

    const { Resend } = await import("resend");
    const { render } = await import("@react-email/render");
    const { BookingConfirmationEmail } = await import(
      "@/lib/email/booking-confirmation"
    );
    const html = await render(BookingConfirmationEmail({ data }));

    const resend = new Resend(apiKey);
    await resend.emails.send(
      {
        from: process.env.EMAIL_FROM ?? "Wanderlost <onboarding@resend.dev>",
        to: email,
        subject: `Your (pretend) trip to ${data.destCity} is booked ✈ (simulation)`,
        html,
        attachments: [
          {
            filename: `wanderlost-${data.pnr}.pdf`,
            content: pdfBuffer,
          },
        ],
      },
      { idempotencyKey: `booking-confirmation/${bookingId}` },
    );
    return "sent";
  } catch (error) {
    console.error("booking-confirmation email failed", error);
    return "failed";
  }
}
