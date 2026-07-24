import { z } from "zod";
import type { HotelOffer } from "@/lib/engine";

/*
 * Serializable hotel-offer view model, mirroring lib/offer-view.ts: what
 * crosses the server→client boundary and what gets stored in the trip
 * draft. The schema is the single source of truth for re-parsing a stored
 * draft's `hotel` field.
 */

export const hotelOfferViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  stars: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  neighborhood: z.string(),
  amenities: z.array(z.string()),
  nightlyCents: z.number(),
  totalCents: z.number(),
  savedCents: z.number(),
  nights: z.number(),
  heroSeed: z.number(),
});

export type HotelOfferView = z.infer<typeof hotelOfferViewSchema>;

export function toHotelOfferView(offer: HotelOffer): HotelOfferView {
  return {
    id: offer.id,
    name: offer.name,
    city: offer.city,
    country: offer.country,
    stars: offer.stars,
    neighborhood: offer.neighborhood,
    amenities: offer.amenities,
    nightlyCents: offer.nightlyCents,
    totalCents: offer.totalCents,
    savedCents: offer.savedCents,
    nights: offer.nights,
    heroSeed: offer.heroSeed,
  };
}
