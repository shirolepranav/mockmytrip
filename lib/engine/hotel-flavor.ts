/*
 * Hotel-detail room-type tiers (Phase 4 task 3/7). Purely presentational —
 * swapping tiers only changes the displayed price/perks; the room tier is
 * never part of what "Select hotel" persists, mirroring flavor.ts's
 * fareOptionsFor (fixed multipliers over the offer's own price, no extra
 * randomness — fareOptionsFor isn't seeded either).
 */

export interface RoomType {
  id: "standard" | "deluxe" | "suite";
  name: string;
  perks: readonly string[];
  nightlyCents: number;
  totalCents: number;
  savedCents: number;
}

const ROOM_TIERS = [
  {
    id: "standard" as const,
    name: "Standard room",
    multiplier: 1,
    perks: ["Queen bed", "City or garden view"],
  },
  {
    id: "deluxe" as const,
    name: "Deluxe room",
    multiplier: 1.35,
    perks: ["King bed", "Upgraded view", "Late checkout"],
  },
  {
    id: "suite" as const,
    name: "Suite",
    multiplier: 1.85,
    perks: ["Separate living area", "Best view", "Late checkout", "Welcome treat"],
  },
] as const;

/** Standard always matches the price already shown on the hotel card. */
export function roomTypesFor(offer: {
  nightlyCents: number;
  savedCents: number;
  nights: number;
}): RoomType[] {
  return ROOM_TIERS.map((tier) => {
    const nightlyCents = Math.round(offer.nightlyCents * tier.multiplier);
    return {
      id: tier.id,
      name: tier.name,
      perks: tier.perks,
      nightlyCents,
      totalCents: nightlyCents * offer.nights,
      savedCents: Math.round(offer.savedCents * tier.multiplier),
    };
  });
}
