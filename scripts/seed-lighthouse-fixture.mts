/*
 * Lighthouse CI fixture (Phase 10 task 8, QA 10.1/10.8): creates a guest
 * user with a checkout-ready draft, then prints a signed session cookie so
 * `lighthouserc.js` can authenticate its `/trip/checkout` and `/trips`
 * runs against a real logged-in session instead of the redirect-away page
 * an anonymous visitor would see. Mirrors scripts/seed.mts's shape (a
 * plain entrypoint script, not a service).
 *
 * Deliberately does NOT also call createBooking(): booking a trip clears
 * the draft as a real side effect (lib/services/bookings.ts deletes the
 * user's tripDrafts row on success — you can't still be "checking out"
 * something you already booked), which would make `/trip/checkout`
 * redirect away again. `/trips` doesn't need a real booking either — an
 * authenticated user with zero trips still renders the real page (not a
 * login redirect), which is all Lighthouse needs to measure it.
 *
 * Run BEFORE `npm run start` — PGlite is file-backed at .data/pglite by
 * default (lib/db/client.ts), so data written here is visible to the
 * server process started afterward, as long as neither sets
 * PGLITE_MEMORY=1 and both run from the repo root.
 */
import { createGuest } from "../lib/services/users";
import { saveDraft } from "../lib/services/trips";
import { searchFlights, searchHotels } from "../lib/engine";
import { toOfferView } from "../lib/offer-view";
import { toHotelOfferView } from "../lib/hotel-offer-view";
import { signSessionValue, SESSION_COOKIE } from "../lib/auth/session";

const DEPART_DATE = "2026-09-01";

const user = await createGuest();

const flightOffers = searchFlights({
  origin: "JFK",
  destination: "LIS",
  departDate: DEPART_DATE,
  passengers: 1,
  cabin: "economy",
});
if (flightOffers.length === 0) {
  throw new Error("Lighthouse fixture: no flight offers generated for JFK→LIS");
}
const flight = toOfferView(flightOffers[0]);

const hotelOffers = searchHotels({
  city: "Lisbon",
  country: "PT",
  checkin: DEPART_DATE,
  checkout: "2026-09-05",
  guests: 2,
  rooms: 1,
});
if (hotelOffers.length === 0) {
  throw new Error("Lighthouse fixture: no hotel offers generated for Lisbon");
}
const hotel = toHotelOfferView(hotelOffers[0]);

// Checkout-ready draft — `/trip/checkout` reads this via getDraft().
await saveDraft(user.id, { flight, hotel });

const cookie = signSessionValue(user.id);
// Single line, name=value only — the CI step captures this directly into
// lighthouserc.js's Cookie header via $LH_FIXTURE_COOKIE.
console.log(`${SESSION_COOKIE}=${cookie}`);

// Explicit exit (mirrors scripts/seed.mts) — PGlite/its WASM runtime can
// keep the event loop alive after the script's own work is done, which
// would otherwise hang whatever CI step is capturing this script's stdout.
process.exit(0);
