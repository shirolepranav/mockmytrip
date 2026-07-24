import { z } from "zod";

/*
 * Hotel-results URL parameter schema, shared by the results page and the
 * hotel detail page so both parse identically (mirrors lib/search-params.ts).
 * Field names match lib/engine's hotelQuerySchema 1:1.
 */

export const hotelResultsParamsSchema = z.object({
  city: z.string().min(1),
  country: z.string().length(2),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(9).default(2),
  rooms: z.coerce.number().int().min(1).max(4).default(1),
  sort: z.enum(["price", "stars"]).default("price"),
  minStars: z.enum(["3", "4", "5"]).optional(),
  amenities: z.string().optional(),
});

export type HotelResultsParams = z.infer<typeof hotelResultsParamsSchema>;

/** Rebuild the canonical query string for links (drops undefined). */
export function hotelResultsQueryString(params: HotelResultsParams): string {
  const query = new URLSearchParams({
    city: params.city,
    country: params.country,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: String(params.guests),
    rooms: String(params.rooms),
  });
  if (params.sort !== "price") query.set("sort", params.sort);
  if (params.minStars) query.set("minStars", params.minStars);
  if (params.amenities) query.set("amenities", params.amenities);
  return query.toString();
}
