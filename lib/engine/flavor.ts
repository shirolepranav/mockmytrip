import { hashSeed, pick, seededRandom } from "./seed";
import type { Cabin } from "./pricing";

/*
 * Flight-detail flavor text (Phase 3 task 7): aircraft type, baggage
 * allowance, and fare tiers. Purely decorative — seeded off the offer id so
 * it's stable on reload, never affects the $0.00 checkout. Aircraft model
 * designators are generic industry equipment, not airline branding, so the
 * real-brand blocklist doesn't apply here.
 */

const JET_AIRCRAFT = [
  "Airbus A320neo",
  "Airbus A321",
  "Airbus A350-900",
  "Boeing 737 MAX 8",
  "Boeing 787-9",
  "Boeing 777-300ER",
  "Embraer E195-E2",
] as const;

const REGIONAL_AIRCRAFT = [
  "Embraer E190",
  "ATR 72-600",
  "Bombardier CRJ900",
  "De Havilland Dash 8-400",
] as const;

/** Short routes (<400km) fly regional equipment, matching schedule.ts's own threshold. */
export function aircraftFor(offer: { id: string; distanceKm: number }): string {
  const rand = seededRandom(hashSeed(offer.id, 0x4c1c7a));
  const pool = offer.distanceKm < 400 ? REGIONAL_AIRCRAFT : JET_AIRCRAFT;
  return pick(rand, pool);
}

const BAGGAGE_BY_CABIN: Record<Cabin, string> = {
  economy: "1 carry-on + personal item · 1 checked bag included (23kg)",
  premium: "1 carry-on + personal item · 2 checked bags included (23kg each)",
  business:
    "1 carry-on + personal item · 2 checked bags included (32kg each) · priority handling",
  first:
    "1 carry-on + personal item · 3 checked bags included (32kg each) · priority handling",
};

export function baggageAllowanceFor(cabin: Cabin): string {
  return BAGGAGE_BY_CABIN[cabin];
}

export interface FareOption {
  id: "value" | "standard" | "flex";
  name: string;
  priceCents: number;
  savedCents: number;
  perks: readonly string[];
}

const FARE_TIERS = [
  {
    id: "value" as const,
    name: "Value",
    multiplier: 0.85,
    perks: ["Seat assigned at boarding", "No changes"],
  },
  {
    id: "standard" as const,
    name: "Standard",
    multiplier: 1,
    perks: ["Seat selection included", "Free date changes"],
  },
  {
    id: "flex" as const,
    name: "Flex",
    multiplier: 1.22,
    perks: [
      "Seat selection included",
      "Free date changes",
      "Fully refundable",
    ],
  },
] as const;

/** Standard always matches the price already shown on the result card. */
export function fareOptionsFor(offer: {
  priceCents: number;
  savedCents: number;
}): FareOption[] {
  return FARE_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    priceCents: Math.round(offer.priceCents * tier.multiplier),
    savedCents: Math.round(offer.savedCents * tier.multiplier),
    perks: tier.perks,
  }));
}
